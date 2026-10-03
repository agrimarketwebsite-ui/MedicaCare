// backend/modules/adminAppointments/adminAppointment.service.js
// Phase 6 — Admin Console: appointment management business logic.
// [ENC]: reason, additional_notes, contact_number, notes — encrypt on write,
// decrypt on read (mga helpers mula sa patients/patient.service.js +
// crypto.js). BAWAT mutating action ay may activity_log write.
// NEVER i-log ang decrypted PHI values (ids/dates/statuses lang sa logs).

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import { encryptField } from '../../shared/utils/crypto.js';
import { decryptRow, encryptRow } from '../patients/patient.service.js';
import { normalizeTime, addMinutesToTime } from '../appointments/appointment.service.js';
import * as repo from './adminAppointment.repository.js';

const APPT_WRITE_ENC_FIELDS = ['reason', 'additional_notes', 'contact_number'];
const APPT_READ_ENC_FIELDS = ['reason', 'additional_notes', 'contact_number', 'notes'];

function toAppointmentDTO(row) {
  const rest = { ...row };
  const patients = rest.patients;
  const doctors = rest.doctors;
  delete rest.patients;
  delete rest.doctors;
  const out = decryptRow(rest, APPT_READ_ENC_FIELDS);
  out.patient = patients
    ? { id: patients.id, full_name: patients.full_name, email: patients.email, phone: patients.phone }
    : null;
  out.doctor = doctors
    ? { id: doctors.id, full_name: doctors.full_name, specialty_name: doctors.specialties?.name ?? null }
    : null;
  return out;
}

/** Human-readable target para sa activity_log detail (walang PHI values). */
function targetOf(row) {
  const ref = row.reference_code ?? row.id;
  const patient = row.patient?.full_name ?? row.patients?.full_name ?? 'unknown patient';
  const doctor = row.doctor?.full_name ?? row.doctors?.full_name ?? 'unknown doctor';
  return `${ref} for ${patient} with ${doctor}`;
}

export async function listAppointments({ date, doctor_id, status, page, limit }) {
  const { rows, total } = await repo.listAppointments({ date, doctorId: doctor_id, status, page, limit });
  return { appointments: rows.map(toAppointmentDTO), total, page, limit };
}

export async function getAppointment(id) {
  const row = await repo.getAppointmentById(id);
  if (!row) throw ApiError.notFound('Appointment not found');
  return { appointment: toAppointmentDTO(row) };
}

export async function createAppointment(actor, input) {
  const { doctor_id, patient_id, appointment_date, start_time, duration_minutes, reason, status,
    booked_for, is_first_visit, additional_notes, contact_number } = input;
  // Tulad ng patient flow: ang end_time ay kino-compute mula sa
  // start_time + duration_minutes (hindi ipinapasa ng caller).
  const end_time = addMinutesToTime(normalizeTime(start_time), duration_minutes);
  try {
    const row = await repo.createAppointment(
      encryptRow(
        {
          doctor_id,
          patient_id,
          appointment_date,
          start_time,
          end_time,
          reason,
          status,
          booked_for: booked_for ?? null,
          is_first_visit,
          additional_notes: additional_notes ?? null,
          contact_number: contact_number ?? null,
        },
        APPT_WRITE_ENC_FIELDS,
      ),
    );
    await logActivity(actor, 'appointment.create', `${targetOf(row)} (date ${appointment_date})`);
    return { appointment: toAppointmentDTO(row) };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('This time slot was just taken. Please choose another slot.');
    }
    throw err;
  }
}

export async function updateAppointment(actor, id, patch) {
  const current = await repo.getAppointmentById(id);
  if (!current) throw ApiError.notFound('Appointment not found');
  try {
    const row = await repo.updateAppointment(id, encryptRow(patch, APPT_WRITE_ENC_FIELDS));
    await logActivity(actor, 'appointment.update', `Updated ${targetOf(row)}`);
    return { appointment: toAppointmentDTO(row) };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('This time slot was just taken. Please choose another slot.');
    }
    throw err;
  }
}

export async function setAppointmentStatus(actor, id, { status }) {
  const current = await repo.getAppointmentById(id);
  if (!current) throw ApiError.notFound('Appointment not found');
  const row = await repo.updateAppointment(id, { status });
  await logActivity(actor, 'appointment.status', `${targetOf(row)} status → ${status}`);
  return { appointment: toAppointmentDTO(row) };
}

/**
 * Admin complete-visit: status → completed + notes, tapos Consultation
 * medical_records row (title = decrypted reason, summary = notes — parehong
 * [ENC]). Direktang repo calls — walang doctorAppointment.service involvement.
 */
export async function completeAppointment(actor, id, { notes }) {
  const current = await repo.getAppointmentById(id);
  if (!current) throw ApiError.notFound('Appointment not found');
  if (!['pending', 'confirmed'].includes(current.status)) {
    throw ApiError.conflict(`Cannot complete an appointment with status '${current.status}'.`);
  }

  const row = await repo.updateAppointment(id, {
    status: 'completed',
    notes: encryptField(notes),
    completed_at: new Date().toISOString(),
  });

  // Ang reason ay naka-ciphertext sa appointments — dini-decrypt muna bago
  // i-encrypt bilang title ng consultation record.
  const decryptedReason = decryptRow({ reason: current.reason }, ['reason']).reason;
  await repo.createConsultationRecord({
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    appointment_id: id,
    visit_date: row.appointment_date,
    record_type: 'Consultation',
    title: encryptField(String(decryptedReason ?? '')),
    summary: encryptField(notes),
  });

  await logActivity(actor, 'appointment.complete', `Completed ${targetOf(row)}`);
  return { appointment: toAppointmentDTO(row) };
}

/** Hard delete: dependents muna (visit_ratings, notifications,
 * medical_records), tapos ang appointment. */
export async function deleteAppointment(actor, id) {
  const current = await repo.getAppointmentById(id);
  if (!current) throw ApiError.notFound('Appointment not found');
  await repo.deleteDependentRows(id);
  const deleted = await repo.deleteAppointment(id);
  if (!deleted) throw ApiError.notFound('Appointment not found');
  await logActivity(actor, 'appointment.delete', `Deleted ${targetOf(current)}`);
  return true;
}

export default {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
  completeAppointment,
  deleteAppointment,
};
