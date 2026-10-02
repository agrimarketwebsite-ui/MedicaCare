// backend/modules/appointments/doctorAppointment.repository.js
// Phase 5 — doctor-scoped appointment persistence.
// BOLA (API1): LAHAT ng reads/writes ay naka-scope sa doctor id na galing sa
// JWT (doctor_accounts.id → doctors.id, nire-resolve ng service). Ang
// appointment ng ibang doctor ay 404, hindi 403 (walang info leak).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[doctorAppointment.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const PATIENT_COLS = 'patients(id, full_name, phone, email)';

// List view: walang additional_notes/contact_number/notes (details view lang).
const DOC_APPT_LIST_COLS =
  `id, reference_code, patient_id, appointment_date, start_time, end_time, reason, booked_for, is_first_visit, status, created_at, ${PATIENT_COLS}`;

const DOC_APPT_DETAIL_COLS =
  `${DOC_APPT_LIST_COLS}, additional_notes, contact_number, notes, updated_at, confirmed_at, completed_at, cancelled_at`;

export async function listDoctorAppointments(doctorId, { from, to, status, patientId } = {}) {
  let query = supabase.from('appointments').select(DOC_APPT_LIST_COLS).eq('doctor_id', doctorId);
  if (from) query = query.gte('appointment_date', from);
  if (to) query = query.lte('appointment_date', to);
  if (status) query = query.eq('status', status);
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });
  return must({ data, error }, 'listDoctorAppointments');
}

/**
 * Lahat ng non-cancelled appointments ng doctor (para sa "My patients"
 * aggregation) — hindi nagbabalik ng PHI lampas sa kailangan.
 */
export async function listDoctorPatientLinks(doctorId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('patient_id, appointment_date, status, patients(id, full_name, phone, email)')
    .eq('doctor_id', doctorId)
    .neq('status', 'cancelled')
    .order('appointment_date', { ascending: false });
  return must({ data, error }, 'listDoctorPatientLinks');
}

/** Ownership-scoped — null kapag hindi sa doctor na ito (→ 404). */
export async function getDoctorAppointmentById(doctorId, id) {
  const { data, error } = await supabase
    .from('appointments')
    .select(DOC_APPT_DETAIL_COLS)
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .maybeSingle();
  return must({ data, error }, 'getDoctorAppointmentById');
}

/** Scoped status/notes update — null kapag hindi sa doctor na ito. */
export async function updateDoctorAppointment(doctorId, id, patch) {
  const { data, error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .select(DOC_APPT_DETAIL_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateDoctorAppointment');
}

/** Status timeline — auto-populated ng DB trigger (binabasa lang). */
export async function getStatusHistory(appointmentId) {
  const { data, error } = await supabase
    .from('appointment_status_history')
    .select('from_status, to_status, created_at')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });
  return must({ data, error }, 'getStatusHistory');
}

/** Medical record na ginawa ng "Complete visit" para sa appointment na ito. */
export async function getMedicalRecordByAppointment(appointmentId) {
  const { data, error } = await supabase
    .from('medical_records')
    .select('id, patient_id, doctor_id, appointment_id, visit_date, record_type, title, summary, created_at')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  return must({ data, error }, 'getMedicalRecordByAppointment');
}

/** Gumawa ng medical_records row (ang "Complete visit" ay laging may kasamang record). */
export async function createMedicalRecord(row) {
  const { data, error } = await supabase
    .from('medical_records')
    .insert(row)
    .select('id, patient_id, doctor_id, appointment_id, visit_date, record_type, title, summary, created_at')
    .single();
  return must({ data, error }, 'createMedicalRecord');
}

export default {
  listDoctorAppointments,
  getDoctorAppointmentById,
  updateDoctorAppointment,
  getStatusHistory,
  getMedicalRecordByAppointment,
  createMedicalRecord,
  listDoctorPatientLinks,
};
