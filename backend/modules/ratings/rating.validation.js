// backend/modules/ratings/rating.validation.js
// Phase 4 — Zod schema para sa visit rating submission.
// .strict(): walang ibang fields (hal. hindi pwedeng i-spoof ang doctor_id —
// kinukuha ito mula sa appointment row sa service).

import { z } from 'zod';

export const createRatingSchema = z
  .object({
    appointment_id: z.string().uuid('Invalid appointment id'),
    stars: z.number().int('Rating must be a whole number of stars').min(1, 'Rating must be 1–5 stars').max(5, 'Rating must be 1–5 stars'),
    comment: z.string().trim().max(500, 'Comment is too long (max 500 characters)').optional(),
  })
  .strict();

export default { createRatingSchema };
