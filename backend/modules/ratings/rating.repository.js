// backend/modules/ratings/rating.repository.js
// Phase 4 — visit_ratings persistence.
// Ang one-rating-per-appointment ay ginagarantiyahan ng DB:
// UNIQUE(appointment_id) — ang 23505 ay hinahandle ng service bilang 409.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[rating.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

/** Ownership-scoped appointment read (id + patient_id) — null kapag hindi sa pasyente. */
export async function getAppointmentForRating(appointmentId, patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, status')
    .eq('id', appointmentId)
    .eq('patient_id', patientId)
    .maybeSingle();
  return must({ data, error }, 'getAppointmentForRating');
}

export async function createRating({ appointment_id, patient_id, doctor_id, stars, comment }) {
  const { data, error } = await supabase
    .from('visit_ratings')
    .insert({ appointment_id, patient_id, doctor_id, stars, comment: comment ?? null })
    .select('id, appointment_id, patient_id, doctor_id, stars, comment, created_at')
    .single();
  if (error) {
    console.error('[rating.repository] createRating:', error.message);
    // 23505 = UNIQUE(appointment_id) — "already rated" (409 sa service).
    const err = new Error('Database error (createRating)');
    err.code = error.code;
    throw err;
  }
  return data;
}

export default { getAppointmentForRating, createRating };
