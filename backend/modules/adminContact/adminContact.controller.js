// backend/modules/adminContact/adminContact.controller.js
// Phase 6 — Admin Console: contact message endpoints. Ang actor (admin email)
// ay nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminContact.service.js';

export const listContactMessages = asyncHandler(async (req, res) => {
  const data = await service.listContactMessages();
  return ok(res, data);
});

export const markHandled = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.markHandled(actor, req.validated.params.id);
  return ok(res, data);
});

export default {
  listContactMessages,
  markHandled,
};
