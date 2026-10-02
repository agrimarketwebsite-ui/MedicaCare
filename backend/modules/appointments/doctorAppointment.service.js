// backend/modules/appointments/doctorAppointment.service.js
// Phase 5 — doctor portal: own schedule (today/week/list), complete visit,
// no-show.
// Security (API1 BOLA):
//   - LAHAT ng queries ay naka-scope: doctor_id = resolveDoctorId(JWT.sub)
//     (JWT.sub = doctor_accounts.id, HINDI doctors.id). Ang appointment ng
//     ibang doctor ay 404, hindi 403.
//   - Status transitions (doctor-initiated): pending/confirmed → completed /
//     no-show. Ang completed/cancelled/no-show ay 409 (hindi na pwedeng
//     baguhin pa).
//   - [ENC]: reason, additional_notes, contact_number, notes — encrypt on
//     write, decrypt on read para sa SARILING doctor lang. NEVER i-log ang
//     decrypted values.
//   - Complete visit ay gumagawa ng medical_records row (record_type
//     'Consultation', title = reason, summary = notes — parehong [ENC]).

import ApiError from '../../shared/utils/ApiError.js';
import { encryptField } from '../../shared/utils/crypto.js';
import { manilaToday } from '../../shared/utils/manilaTime.js';
import { resolveDoctorId } from '../doctors/doctor.service.js';
import { decryptRow, MEDICAL_RECORD_ENC_FIELDS } from '../records/record.service.js';
import { decryptRow as decryptPatientRow } from '../patients/patient.service.js';
import * as repo from './doctorAppointment.repository.js';

// ---- Doctor-initiated status transition matrix (exported para ma-unit-test) ----
const DOCTOR_MUTABLE_STATUSES = new Set(['pending', 'confirmed']);

export const doctorCompleteAllowed = (status) => DOCTOR_MUTABLE_STATUSES.has(status);
export const doctorNoShowAllowed = (status) => DOCTOR_MUTABLE_STATUSES.has(status);

// ---- DTO mapping ----

/** [ENC] fields na dini-decrypt para sa sariling doctor. */
const DOC_APPT_LIST_ENC_FIELDS = ['reason'];
const DOC_APPT_DETAIL_ENC_FIELDS = ['reason', 'additional_notes', 'contact_number', 'notes'];

function toPatientDTO(row) {
  const p = row.patients;
  if (!p) return null;
  return { id: p.id, full_name: p.full_name, phone: p.phone, email: p.email };
}

export function toDoctorAppointmentDTO(row, { detail = false, statusHistory = null, medicalRecord = null } = {}) {
  const rest = { ...row };
  delete rest.patients;
  const out = decryptPatientRow(rest, detail ? DOC_APPT_DETAIL_ENC_FIELDS : DOC_APPT_LIST_ENC_FIELDS);
  out.patient = toPatientDTO(row);
  if (detail && statusHistory) out.status_history = statusHistory;
  if (detail && medicalRecord) out.medical_record = decryptRow(medicalRecord, MEDICAL_RECORD_ENC_FIELDS);
  return out;
}

// ---- Week helper (pure, unit-testable) ----

/**
 * Monday–Sunday week na naglalaman ng `dateStr` (YYYY-MM-DD).
 * @returns { week_start, week_end } (parehong YYYY-MM-DD).
 */
export function weekRangeContaining(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jsDay = dt.getUTCDay(); // 0 = Sun
  const mondayOffset = (jsDay + 6) % 7; // araw pabalik sa Monday
  const monday = new Date(Date.UTC(y, m - 1, d - mondayOffset));
  const sunday = new Date(Date.UTC(y, m - 1, d - mondayOffset + 6));
  return { week_start: monday.toISOString().slice(0, 10), week_end: sunday.toISOString().slice(0, 10) };
}

// ---- Schedule reads ----

export async function listSchedule(accountId, { date, from, to, status, patient_id } = {}) {
  const doctorId = await resolveDoctorId(accountId);
  const range = date ? { from: date, to: date } : { from, to };
  const rows = await repo.listDoctorAppointments(doctorId, { ...range, status, patientId: patient_id });
  return { appointments: rows.map((r) => toDoctorAppointmentDTO(r)) };
}

/**
 * "My patients": mga pasyenteng may ≥1 non-cancelled appointment sa doctor
 * na ito (hindi buong directory) — may visit count at last visit date.
 */
export async function listPatients(accountId) {
  const doctorId = await resolveDoctorId(accountId);
  const rows = await repo.listDoctorPatientLinks(doctorId);
  const map = new Map();
  for (const r of rows) {
    const p = r.patients;
    if (!p) continue;
    if (!map.has(p.id)) {
      map.set(p.id, {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        email: p.email,
        visit_count: 0,
        last_visit_date: r.appointment_date,
      });
    }
    const entry = map.get(p.id);
    entry.visit_count += 1;
    // rows ay naka-order desc — ang unang row ang pinakabagong visit
  }
  return { patients: [...map.values()] };
}

export async function getTodaySchedule(accountId) {
  const doctorId = await resolveDoctorId(accountId);
  const today = manilaToday();
  const rows = await repo.listDoctorAppointments(doctorId, { from: today, to: today });
  return { date: today, appointments: rows.map((r) => toDoctorAppointmentDTO(r)) };
}

export async function getWeekSchedule(accountId, start) {
  const doctorId = await resolveDoctorId(accountId);
  const { week_start, week_end } = weekRangeContaining(start || manilaToday());
  const rows = await repo.listDoctorAppointments(doctorId, { from: week_start, to: week_end });
  return {
    week_start,
    week_end,
    appointments: rows.map((r) => toDoctorAppointmentDTO(r)),
  };
}

export async function getAppointmentDetail(accountId, id) {
  const doctorId = await resolveDoctorId(accountId);
  const row = await repo.getDoctorAppointmentById(doctorId, id);
  if (!row) throw ApiError.notFound('Appointment not found'); // ibang doctor → 404
  const history = await repo.getStatusHistory(id);
  const medicalRecord = await repo.getMedicalRecordByAppointment(id);
  return {
    appointment: toDoctorAppointmentDTO(row, { detail: true, statusHistory: history, medicalRecord }),
  };
}

// ---- Complete visit / no-show ----

export async function completeVisit(accountId, id, { notes }) {
  const doctorId = await resolveDoctorId(accountId);
  const current = await repo.getDoctorAppointmentById(doctorId, id);
  if (!current) throw ApiError.notFound('Appointment not found');
  if (!doctorCompleteAllowed(current.status)) {
    throw ApiError.conflict(`Cannot complete an appointment with status '${current.status}'.`);
  }

  const nowIso = new Date().toISOString();
  const updated = await repo.updateDoctorAppointment(doctorId, id, {
    status: 'completed',
    notes: encryptField(notes),
    completed_at: nowIso,
  });

  // Ang visit ay laging may kasamang medical record: title = reason,
  // summary = notes — parehong [ENC] (ang reason ay naka-ciphertext sa
  // appointments, kaya dini-decrypt muna bago i-encrypt bilang title).
  const decrypted = decryptPatientRow(updated, DOC_APPT_DETAIL_ENC_FIELDS);
  const recordRow = await repo.createMedicalRecord({
    patient_id: updated.patient_id,
    doctor_id: doctorId,
    appointment_id: id,
    visit_date: updated.appointment_date,
    record_type: 'Consultation',
    title: encryptField(decrypted.reason),
    summary: encryptField(notes),
  });

  const history = await repo.getStatusHistory(id);
  return {
    appointment: toDoctorAppointmentDTO(updated, {
      detail: true,
      statusHistory: history,
      medicalRecord: recordRow,
    }),
    medical_record: decryptRow(recordRow, MEDICAL_RECORD_ENC_FIELDS),
  };
}

export async function markNoShow(accountId, id) {
  const doctorId = await resolveDoctorId(accountId);
  const current = await repo.getDoctorAppointmentById(doctorId, id);
  if (!current) throw ApiError.notFound('Appointment not found');
  if (!doctorNoShowAllowed(current.status)) {
    throw ApiError.conflict(`Cannot mark as no-show an appointment with status '${current.status}'.`);
  }
  // Ang no-show ay nagpapalaya ng slot: ang uq_appointments_active_slot ay
  // pending/confirmed lang — walang DB change na kailangan dito.
  const updated = await repo.updateDoctorAppointment(doctorId, id, { status: 'no-show' });
  const history = await repo.getStatusHistory(id);
  return { appointment: toDoctorAppointmentDTO(updated, { detail: true, statusHistory: history }) };
}

export default {
  doctorCompleteAllowed,
  doctorNoShowAllowed,
  toDoctorAppointmentDTO,
  weekRangeContaining,
  listSchedule,
  getTodaySchedule,
  getWeekSchedule,
  getAppointmentDetail,
  completeVisit,
  markNoShow,
};
