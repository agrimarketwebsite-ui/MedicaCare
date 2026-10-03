// backend/modules/adminNotifications/adminNotification.controller.js
// Phase 6 — Admin Console: notification endpoints. Ang actor (admin email) ay
// nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminNotification.service.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const data = await service.listNotifications({ patient_id: req.validated.query.patient_id });
  return ok(res, data);
});

export const createNotification = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.createNotification(actor, req.validated.body);
  return created(res, data);
});

export default {
  listNotifications,
  createNotification,
};
