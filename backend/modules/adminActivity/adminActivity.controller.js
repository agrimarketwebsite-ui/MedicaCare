// backend/modules/adminActivity/adminActivity.controller.js
// Phase 6 — Admin Console: audit trail endpoint.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import * as service from './adminActivity.service.js';

export const listActivity = asyncHandler(async (req, res) => {
  const { actor, action, from, to, page, limit } = req.validated.query;
  const result = await service.listActivity({ actor, action, from, to, page, limit });
  return ok(res, result, { total: result.total, page, limit });
});

export default {
  listActivity,
};
