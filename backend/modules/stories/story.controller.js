// backend/modules/stories/story.controller.js
// Phase 3 — GET /api/stories.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import * as service from './story.service.js';

export const listStories = asyncHandler(async (req, res) => {
  const data = await service.listApprovedStories(req.validated.query.limit);
  return ok(res, data);
});

export default { listStories };
