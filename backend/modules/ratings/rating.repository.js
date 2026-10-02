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

/** Ratings ng sariling visits ng doctor (bagong feedback muna). */
export async function listRatingsByDoctor(doctorId) {
  const { data, error } = await supabase
    .from('visit_ratings')
    .select(
      'id, appointment_id, patient_id, stars, comment, created_at, appointments(appointment_date), patients(full_name)',
    )
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listRatingsByDoctor');
}

/** Average + count mula sa v_doctor_rating_averages (tulad ng Phase 3 directory). */
export async function getAverageForDoctor(doctorId) {
  const { data, error } = await supabase
    .from('v_doctor_rating_averages')
    .select('doctor_id, avg_rating, rating_count')
    .eq('doctor_id', doctorId)
    .maybeSingle();
  const row = must({ data, error }, 'getAverageForDoctor');
  if (!row) return { avg_rating: null, rating_count: 0 };
  return { avg_rating: Number(row.avg_rating), rating_count: Number(row.rating_count) };
}

export default { getAppointmentForRating, createRating, listRatingsByDoctor, getAverageForDoctor };
