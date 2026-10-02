// backend/modules/ratings/rating.controller.js
// Phase 4 — POST /api/ratings.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created } from '../../shared/utils/apiResponse.js';
import * as service from './rating.service.js';

export const create = asyncHandler(async (req, res) => {
  const rating = await service.submitRating(req.user.id, req.validated.body);
  return created(res, { rating });
});

export default { create };
