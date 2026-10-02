// backend/modules/appointments/appointment.repository.js
// Phase 4 — appointment persistence + fn_available_slots RPC.
// BOLA (API1): LAHAT ng reads/writes ay naka-scope sa patient id na galing sa
// JWT (ipinapasa ng service). Ang status history ay TRIGGER-written —
// binabasa lang dito, hindi kailanman sinusulatan nang mano-mano.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[appointment.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

/**
 * Slots mula sa DB function fn_available_slots(doctor, date, duration,
 * exclude_appt). Ang is_available=false kapag taken O outside clinic hours —
 * ang service ang naghahanap ng hiniling na start_time dito.
 */
export async function getSlots(doctorId, date, durationMinutes, excludeApptId = null) {
  const { data, error } = await supabase.rpc('fn_available_slots', {
    p_doctor_id: doctorId,
    p_date: date,
    p_slot_minutes: durationMinutes,
    p_exclude_appt_id: excludeApptId,
  });
  return must({ data, error }, 'getSlots');
}

// List view: walang additional_notes/contact_number/notes (details view lang).
const APPT_LIST_COLS =
  'id, reference_code, doctor_id, appointment_date, start_time, end_time, reason, booked_for, is_first_visit, status, created_at, doctors(id, full_name, specialties(name))';

const APPT_DETAIL_COLS = `${APPT_LIST_COLS}, additional_notes, contact_number, notes, updated_at, confirmed_at, completed_at, cancelled_at`;

export async function listAppointments(patientId, { status } = {}) {
  let query = supabase.from('appointments').select(APPT_LIST_COLS).eq('patient_id', patientId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: false });
  return must({ data, error }, 'listAppointments');
}

/** Ownership-scoped — null kapag hindi pag-aari ng pasyente (→ 404). */
export async function getAppointmentById(id, patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPT_DETAIL_COLS)
    .eq('id', id)
    .eq('patient_id', patientId)
    .maybeSingle();
  return must({ data, error }, 'getAppointmentById');
}

export async function createAppointment(row) {
  const { data, error } = await supabase
    .from('appointments')
    .insert(row)
    .select(APPT_DETAIL_COLS)
    .single();
  if (error) {
    console.error('[appointment.repository] createAppointment:', error.message);
    // I-attach ang Postgres code — ang 23505 (uq_appointments_active_slot,
    // ang slot-race backstop) ay hinahandle ng service bilang 409, hindi 500.
    const err = new Error('Database error (createAppointment)');
    err.code = error.code;
    throw err;
  }
  return data;
}

export async function updateAppointment(id, patientId, patch) {
  const { data, error } = await supabase
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .eq('patient_id', patientId)
    .select(APPT_DETAIL_COLS)
    .single();
  return must({ data, error }, 'updateAppointment');
}

/** Status timeline — auto-populated ng DB trigger (fn_appointment_status_history). */
export async function getStatusHistory(appointmentId) {
  const { data, error } = await supabase
    .from('appointment_status_history')
    .select('from_status, to_status, created_at')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });
  return must({ data, error }, 'getStatusHistory');
}

/**
 * Aling appointment ids (ng pasyenteng ito) ang may visit_ratings row na —
 * ISANG query para sa buong listahan (walang N+1). Ginagamit ng service
 * para sa `rated` flag ng DTO (Issue: hindi alam ng UI kung na-rate na).
 */
export async function getRatedAppointmentIds(patientId, appointmentIds) {
  if (!appointmentIds.length) return [];
  const { data, error } = await supabase
    .from('visit_ratings')
    .select('appointment_id')
    .eq('patient_id', patientId)
    .in('appointment_id', appointmentIds);
  return must({ data, error }, 'getRatedAppointmentIds');
}

export default {
  getSlots,
  listAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  getStatusHistory,
  getRatedAppointmentIds,
};
