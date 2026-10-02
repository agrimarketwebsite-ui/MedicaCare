// backend/modules/ratings/rating.controller.js
// Phase 4 — POST /api/ratings (patient).
// Phase 5 — GET /api/ratings/doctor (doctor feedback view).

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created, ok } from '../../shared/utils/apiResponse.js';
import * as service from './rating.service.js';

export const create = asyncHandler(async (req, res) => {
  const rating = await service.submitRating(req.user.id, req.validated.body);
  return created(res, { rating });
});

export const doctorFeedback = asyncHandler(async (req, res) => {
  const data = await service.getDoctorFeedback(req.user.id);
  return ok(res, data);
});

export default { create, doctorFeedback };
