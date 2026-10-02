// backend/modules/ratings/rating.service.js
// Phase 4 — visit rating submission.
// Rules:
//   - Ang appointment ay dapat EXIST at pag-aari ng pasyente (BOLA) —
//     kapag hindi, 404 (hindi 403, para walang info leak).
//   - Tanging 'completed' appointments ang pwedeng i-rate (409 kung hindi).
//   - Isa lang rating per appointment — ang UNIQUE(appointment_id) DB guard
//     ang final arbiter; ang 23505 ay nagiging 409, hindi 500.

import ApiError from '../../shared/utils/ApiError.js';
import * as repo from './rating.repository.js';

export async function submitRating(patientId, { appointment_id, stars, comment }) {
  const appt = await repo.getAppointmentForRating(appointment_id, patientId);
  if (!appt) throw ApiError.notFound('Appointment not found');

  if (appt.status !== 'completed') {
    throw ApiError.conflict('You can only rate a completed appointment.');
  }

  let rating;
  try {
    rating = await repo.createRating({
      appointment_id,
      patient_id: patientId,
      doctor_id: appt.doctor_id,
      stars,
      comment,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('This appointment has already been rated.');
    }
    throw err;
  }
  return rating;
}

export default { submitRating };
