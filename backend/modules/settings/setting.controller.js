// backend/modules/settings/setting.controller.js
// Phase 3 — GET /api/settings/public.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import * as service from './setting.service.js';

export const getPublicSettings = asyncHandler(async (_req, res) => {
  const data = await service.getPublicSettings();
  return ok(res, data);
});

export default { getPublicSettings };
