// backend/modules/adminAppointments/adminAppointment.controller.js
// Phase 6 — Admin Console: appointment endpoints. Ang actor (admin email) ay
// nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created, noContent } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminAppointment.service.js';

export const listAppointments = asyncHandler(async (req, res) => {
  const { date, doctor_id, status, page, limit } = req.validated.query;
  const result = await service.listAppointments({ date, doctor_id, status, page, limit });
  return ok(res, result, { total: result.total, page, limit });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const data = await service.getAppointment(req.validated.params.id);
  return ok(res, data);
});

export const createAppointment = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.createAppointment(actor, req.validated.body);
  return created(res, data);
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updateAppointment(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const setAppointmentStatus = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.setAppointmentStatus(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const completeAppointment = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.completeAppointment(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const deleteAppointment = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  await service.deleteAppointment(actor, req.validated.params.id);
  return noContent(res);
});

export default {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
  completeAppointment,
  deleteAppointment,
};
