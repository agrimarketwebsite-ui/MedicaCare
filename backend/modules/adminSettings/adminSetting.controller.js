// backend/modules/adminSettings/adminSetting.controller.js
// Phase 6 — Admin Console: settings endpoints. Ang actor (admin email) ay
// nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminSetting.service.js';

export const getClinic = asyncHandler(async (req, res) => {
  const data = await service.getClinicInfo();
  return ok(res, data);
});

export const updateClinic = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updateClinicInfo(actor, req.validated.body);
  return ok(res, data);
});

export const getApp = asyncHandler(async (req, res) => {
  const data = await service.getAppSettings();
  return ok(res, data);
});

export const updateApp = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updateAppSettings(actor, req.validated.body);
  return ok(res, data);
});

export default {
  getClinic,
  updateClinic,
  getApp,
  updateApp,
};
