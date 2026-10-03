// backend/modules/adminAppointments/adminAppointment.repository.js
// Phase 6 — Admin Console: appointment persistence (admin scope — WALANG
// patient/doctor BOLA dito; ang access ay requireRole('admin')).
// Ang hard delete ay naglilinis MUNA ng dependent rows by appointment_id
// (visit_ratings, notifications, medical_records) bago ang appointment.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminAppointment.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const PATIENT_EMBED = 'patients(id, full_name, email, phone)';
const DOCTOR_EMBED = 'doctors(id, full_name, specialties(name))';

export const ADMIN_APPT_COLS =
  `id, reference_code, doctor_id, patient_id, appointment_date, start_time, end_time, reason, ` +
  `booked_for, is_first_visit, status, additional_notes, contact_number, notes, ` +
  `created_at, updated_at, confirmed_at, completed_at, cancelled_at, ${PATIENT_EMBED}, ${DOCTOR_EMBED}`;

export async function listAppointments({ date, doctorId, status, page, limit }) {
  let query = supabase.from('appointments').select(ADMIN_APPT_COLS, { count: 'exact' });
  if (date) query = query.eq('appointment_date', date);
  if (doctorId) query = query.eq('doctor_id', doctorId);
  if (status) query = query.eq('status', status);
  const offset = (page - 1) * limit;
  const { data, error, count } = await query
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1);
  must({ data, error }, 'listAppointments');
  return { rows: data, total: count ?? data.length };
}

export async function getAppointmentById(id) {
  const { data, error } = await supabase
    .from('appointments')
    .select(ADMIN_APPT_COLS)
    .eq('id', id)
    .maybeSingle();
  return must({ data, error }, 'getAppointmentById');
}

export async function createAppointment(row) {
  const { data, error } = await supabase
    .from('appointments')
    .insert(row)
    .select(ADMIN_APPT_COLS)
    .single();
  if (error) {
    console.error('[adminAppointment.repository] createAppointment:', error.message);
    // I-attach ang Postgres code — ang 23505 (uq_appointments_active_slot)
    // ay hinahandle ng service bilang 409, hindi 500.
    const err = new Error('Database error (createAppointment)');
    err.code = error.code;
    throw err;
  }
  return data;
}

export async function updateAppointment(id, patch) {
  const { data, error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .select(ADMIN_APPT_COLS)
    .maybeSingle();
  if (error) {
    console.error('[adminAppointment.repository] updateAppointment:', error.message);
    const err = new Error('Database error (updateAppointment)');
    err.code = error.code; // 23505 (slot race) → 409
    throw err;
  }
  return data;
}

/** Burahin ang dependent rows bago ang appointment (hard delete order). */
export async function deleteDependentRows(appointmentId) {
  for (const table of ['visit_ratings', 'notifications', 'medical_records']) {
    const { error } = await supabase.from(table).delete().eq('appointment_id', appointmentId);
    if (error) {
      console.error(`[adminAppointment.repository] deleteDependentRows(${table}):`, error.message);
      throw new Error(`Database error (deleteDependentRows:${table})`);
    }
  }
  return true;
}

export async function deleteAppointment(id) {
  const { data, error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[adminAppointment.repository] deleteAppointment:', error.message);
    throw new Error('Database error (deleteAppointment)');
  }
  return Boolean(data);
}

/** Consultation row para sa complete-visit — direktang repo call (walang
 * doctorAppointment.service involvement). */
export async function createConsultationRecord(row) {
  const { data, error } = await supabase
    .from('medical_records')
    .insert(row)
    .select('id, patient_id, doctor_id, appointment_id, visit_date, record_type, title, summary, created_at')
    .single();
  return must({ data, error }, 'createConsultationRecord');
}

export default {
  ADMIN_APPT_COLS,
  listAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteDependentRows,
  deleteAppointment,
  createConsultationRecord,
};
