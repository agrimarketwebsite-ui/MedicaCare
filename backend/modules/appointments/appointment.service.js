// backend/modules/appointments/appointment.service.js
// Phase 4 — booking core: slots, create, list, detail, reschedule, cancel.
// Security (API1 BOLA — pinaka-maraming surface sa roadmap):
//   - LAHAT ng queries ay naka-scope: patient_id = JWT.sub (ipinapasa ng
//     controller mula sa req.user.id). Hindi trusted ang patient id mula sa
//     body/params — ang appointment ng ibang pasyente ay 404, hindi 403.
//   - Slot race: re-check via fn_available_slots sa service + ang
//     uq_appointments_active_slot partial unique index ang DB backstop — ang
//     23505 ay nagiging 409, HINDI 500.
//   - Status transitions: patient-initiated lang ang pending/confirmed →
//     cancelled / reschedule. Ang completed/cancelled/no-show ay 409.
//   - [ENC]: reason, additional_notes, contact_number (at notes sa detail) —
//     encrypt on write, decrypt on read para sa owner. NEVER i-log ang
//     decrypted values (ids/dates/statuses lang sa logs).

import ApiError from '../../shared/utils/ApiError.js';
import { encryptField } from '../../shared/utils/crypto.js';
import { manilaNowHHMM, manilaToday } from '../../shared/utils/manilaTime.js';
import { decryptRow } from '../patients/patient.service.js';
import { getPublicPreferences } from '../settings/setting.repository.js';
import * as repo from './appointment.repository.js';
import * as patientRepo from '../patients/patient.repository.js';

// ---- Patient-initiated status transition matrix ----
// Ang doctor/admin transitions (complete, no-show) ay Phase 5/6.
// Exported para ma-unit-test (appointments.unit.test.js).
const PATIENT_MUTABLE_STATUSES = new Set(['pending', 'confirmed']);

export const patientCancelAllowed = (status) => PATIENT_MUTABLE_STATUSES.has(status);
export const patientRescheduleAllowed = (status) => PATIENT_MUTABLE_STATUSES.has(status);

// ---- Time helpers (pure, unit-testable) ----

/** 'HH:MM' o 'HH:MM:SS[.ffffff]' → 'HH:MM:SS' (pang-compare sa fn output). */
export function normalizeTime(t) {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(t).trim());
  if (!m) throw new Error(`normalizeTime: invalid time value '${t}'`);
  return `${m[1]}:${m[2]}:${m[3] ?? '00'}`;
}

/** 'HH:MM' + minutes → 'HH:MM:SS' (umiikot sa midnight kung kailangan). */
export function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

// ---- DTO mapping ----

/** [ENC] fields na dini-decrypt sa writes (booking) at reads. */
const APPT_WRITE_ENC_FIELDS = ['reason', 'additional_notes', 'contact_number'];
/** Detail view: kasama ang doctor-written notes ([ENC] din). */
const APPT_READ_ENC_FIELDS = [...APPT_WRITE_ENC_FIELDS, 'notes'];

function toDoctorDTO(row) {
  const d = row.doctors;
  if (!d) return null;
  return { id: d.id, full_name: d.full_name, specialty_name: d.specialties?.name ?? null };
}

/**
 * Row → API shape. Ang list view ay hindi kasama ang additional_notes /
 * contact_number / notes (details view lang); ang reason ay decrypted para
 * sa owner (sariling data niya).
 */
export function toAppointmentDTO(row, { detail = false, statusHistory = null, rated = false } = {}) {
  const rest = { ...row };
  delete rest.doctors; // ang embed ay pinalitan ng flattened na `doctor` DTO sa ibaba
  const out = decryptRow(rest, detail ? APPT_READ_ENC_FIELDS : ['reason']);
  out.doctor = toDoctorDTO(row);
  // May visit_ratings row na ba ang appointment na ito? Kailangan ng UI
  // para itago ang "Rate your visit" (ang localStorage record ay per-device
  // lang — ang DB ang source of truth). Ang caller ang nagko-compute via
  // ratedIdSet() (isang query, walang N+1); default false (hal. bagong
  // booking — hindi pa pwedeng ma-rate).
  out.rated = Boolean(rated);
  if (detail && statusHistory) out.status_history = statusHistory;
  return out;
}

/** Set ng appointment ids (mula sa rows) na may rating na — isang query. */
async function ratedIdSet(patientId, rows) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return new Set();
  const rated = await repo.getRatedAppointmentIds(patientId, ids);
  return new Set(rated.map((r) => r.appointment_id));
}

// ---- Attendee overlap guard (patient-level double-booking) ----
// Ang uq_appointments_active_slot ay per-DOCTOR lang: hindi nito napipigilan
// ang IISANG attendee na mag-book ng dalawang magkaibang doctor sa parehong
// oras. Ang attendee identity sa schema ay ang `booked_for` snapshot
// (NULL = self; family booking = pangalan ng family member — ang
// family_member_id ay request-scoped lang, hindi naka-store na column).
const ACTIVE_STATUSES = new Set(['pending', 'confirmed']);

/**
 * Purong overlap test (unit-testable): may conflict ba ang candidate
 * [start_time, end_time) + attendee laban sa mga existing row?
 * - Parehong attendee lang ang kinukumpara (booked_for; null = self).
 * - Half-open interval: ang back-to-back (end == start) ay HINDI overlap.
 * - Rows na hindi active (kung may status field) ay nilalaktawan — ang
 *   repository query ay naka-filter na, ito ay defense-in-depth.
 * @returns ang conflicting row, o null kung walang overlap.
 */
export function findAttendeeOverlap(existingRows, { start_time, end_time, booked_for = null }) {
  const start = normalizeTime(start_time);
  const end = normalizeTime(end_time);
  const attendee = booked_for ?? null;
  return (
    existingRows.find(
      (r) =>
        (r.booked_for ?? null) === attendee &&
        (!r.status || ACTIVE_STATUSES.has(r.status)) &&
        normalizeTime(r.start_time) < end &&
        start < normalizeTime(r.end_time),
    ) ?? null
  );
}

/** I-409 kapag ang attendee ay may aktibong appointment na kasabay ng oras na ito. */
async function assertNoAttendeeOverlap(patientId, date, candidate, excludeId = null) {
  const rows = await repo.listActiveAppointmentsOnDate(patientId, date, excludeId);
  if (findAttendeeOverlap(rows, candidate)) {
    throw ApiError.conflict('You already have an appointment at this time. Please choose another time.');
  }
}

// ---- Slots ----

/** Hanapin ang hiniling na start_time sa fn output — dapat available. */
async function findAvailableSlot(doctorId, date, durationMinutes, startTime, excludeApptId) {
  const slots = await repo.getSlots(doctorId, date, durationMinutes, excludeApptId);
  const wanted = normalizeTime(startTime);
  return slots.find((s) => normalizeTime(s.slot_start) === wanted && Boolean(s.is_available)) ?? null;
}

export async function getSlots(doctorId, date, durationMinutes) {
  const rows = await repo.getSlots(doctorId, date, durationMinutes, null);
  return rows.map((s) => ({
    start_time: normalizeTime(s.slot_start),
    end_time: normalizeTime(s.slot_end),
    is_available: Boolean(s.is_available),
  }));
}

// ---- Booking ----

/** Same-day rule: hindi pwedeng mag-book ng oras na nakalipas na ngayong araw (Manila). */
function assertNotPastToday(date, startTime) {
  if (date === manilaToday() && normalizeTime(startTime) <= `${manilaNowHHMM()}:00`) {
    throw ApiError.badRequest('Cannot book a time slot that has already passed today.');
  }
}

export async function createAppointment(patientId, input) {
  const {
    doctor_id,
    appointment_date,
    start_time,
    duration_minutes,
    reason,
    additional_notes,
    contact_number,
    is_first_visit,
    family_member_id,
  } = input;

  assertNotPastToday(appointment_date, start_time);

  // Proxy booking: ang family member ay DAPAT pag-aari ng pasyente (BOLA).
  // Ang booked_for ay plaintext name snapshot (schema comment).
  let bookedFor = null;
  if (family_member_id) {
    const member = await patientRepo.getFamilyMember(family_member_id, patientId);
    if (!member) throw ApiError.notFound('Family member not found');
    bookedFor = decryptRow(member, ['full_name']).full_name;
  }

  // Slot availability: ang hiniling na start_time ay DAPAT lumabas bilang
  // available sa fn_available_slots — ito na rin ang within-clinic-hours
  // check (ang oras na wala sa availability ay hindi lumalabas → 409).
  const slot = await findAvailableSlot(doctor_id, appointment_date, duration_minutes, start_time, null);
  if (!slot) {
    throw ApiError.conflict('The selected time slot is not available. Please choose another slot.');
  }

  // Attendee overlap: kahit available ang slot ng doctor, hindi pwedeng
  // kasabay nito ang isa pang aktibong appointment ng PAREHONG attendee
  // (self vs. family member ay magkaibang attendee).
  const newStart = normalizeTime(start_time);
  const newEnd = addMinutesToTime(start_time, duration_minutes);
  await assertNoAttendeeOverlap(patientId, appointment_date, {
    start_time: newStart,
    end_time: newEnd,
    booked_for: bookedFor,
  });

  const prefs = await getPublicPreferences().catch(() => null);
  const status = prefs?.auto_confirm_appointments ? 'confirmed' : 'pending';

  let row;
  try {
    row = await repo.createAppointment({
      patient_id: patientId,
      doctor_id,
      appointment_date,
      start_time: newStart,
      end_time: newEnd,
      reason: encryptField(reason),
      additional_notes: additional_notes ? encryptField(additional_notes) : null,
      contact_number: encryptField(contact_number),
      booked_for: bookedFor,
      is_first_visit,
      status,
    });
  } catch (err) {
    if (err.code === '23505') {
      // uq_appointments_active_slot — naunahan sa slot (race). Hindi 500.
      throw ApiError.conflict('This time slot was just taken. Please choose another slot.');
    }
    throw err;
  }
  // Sariling booking confirmation — decrypted para sa owner.
  return toAppointmentDTO(row, { detail: true });
}

export async function listAppointments(patientId, { status } = {}) {
  const rows = await repo.listAppointments(patientId, { status });
  const rated = await ratedIdSet(patientId, rows);
  return rows.map((r) => toAppointmentDTO(r, { rated: rated.has(r.id) }));
}

export async function getAppointment(patientId, id) {
  const row = await repo.getAppointmentById(id, patientId);
  if (!row) throw ApiError.notFound('Appointment not found');
  const history = await repo.getStatusHistory(id);
  const rated = await ratedIdSet(patientId, [row]);
  return toAppointmentDTO(row, { detail: true, statusHistory: history, rated: rated.has(row.id) });
}

export async function rescheduleAppointment(patientId, id, { appointment_date, start_time, duration_minutes }) {
  const current = await repo.getAppointmentById(id, patientId);
  if (!current) throw ApiError.notFound('Appointment not found');
  if (!patientRescheduleAllowed(current.status)) {
    throw ApiError.conflict(`Cannot reschedule an appointment with status '${current.status}'.`);
  }

  assertNotPastToday(appointment_date, start_time);

  // p_exclude_appt_id = sariling id — ang kasalukuyang slot ay hindi
  // tinuturing na taken, kaya pwedeng manatili sa dating oras.
  const slot = await findAvailableSlot(current.doctor_id, appointment_date, duration_minutes, start_time, id);
  if (!slot) {
    throw ApiError.conflict('The selected time slot is not available. Please choose another slot.');
  }

  // Attendee overlap: ang bagong oras ay hindi pwedeng kasabay ng ibang
  // aktibong appointment ng parehong attendee (ang appointment na ito mismo
  // ay excluded sa query — ang booked_for niya ang attendee identity).
  await assertNoAttendeeOverlap(
    patientId,
    appointment_date,
    {
      start_time: normalizeTime(start_time),
      end_time: addMinutesToTime(start_time, duration_minutes),
      booked_for: current.booked_for ?? null,
    },
    id,
  );

  const row = await repo.updateAppointment(id, patientId, {
    appointment_date,
    start_time: normalizeTime(start_time),
    end_time: addMinutesToTime(start_time, duration_minutes),
  });
  return toAppointmentDTO(row, { detail: true });
}

export async function cancelAppointment(patientId, id) {
  const current = await repo.getAppointmentById(id, patientId);
  if (!current) throw ApiError.notFound('Appointment not found');
  if (!patientCancelAllowed(current.status)) {
    throw ApiError.conflict(`Cannot cancel an appointment with status '${current.status}'.`);
  }
  const row = await repo.updateAppointment(id, patientId, { status: 'cancelled' });
  return toAppointmentDTO(row, { detail: true });
}

export default {
  patientCancelAllowed,
  patientRescheduleAllowed,
  normalizeTime,
  addMinutesToTime,
  findAttendeeOverlap,
  toAppointmentDTO,
  getSlots,
  createAppointment,
  listAppointments,
  getAppointment,
  rescheduleAppointment,
  cancelAppointment,
};
