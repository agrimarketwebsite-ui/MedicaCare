// backend/modules/adminStories/adminStory.controller.js
// Phase 6 — Admin Console: story moderation endpoints. Ang actor (admin
// email) ay nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminStory.service.js';

export const listStories = asyncHandler(async (req, res) => {
  const data = await service.listStories({ status: req.validated.query.status });
  return ok(res, data);
});

export const approveStory = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.approveStory(actor, req.validated.params.id);
  return ok(res, data);
});

export const rejectStory = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.rejectStory(actor, req.validated.params.id);
  return ok(res, data);
});

export const unpublishStory = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.unpublishStory(actor, req.validated.params.id);
  return ok(res, data);
});

export default {
  listStories,
  approveStory,
  rejectStory,
  unpublishStory,
};
