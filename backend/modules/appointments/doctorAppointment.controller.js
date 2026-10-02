// backend/modules/appointments/doctorAppointment.controller.js
// Phase 5 — doctor-scoped appointment endpoints (own schedule, complete
// visit, no-show). Lahat ay requireRole('doctor'); ang BOLA scoping ay nasa
// service via resolveDoctorId.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created, ok } from '../../shared/utils/apiResponse.js';
import * as service from './doctorAppointment.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await service.listSchedule(req.user.id, req.validated.query);
  return ok(res, data);
});

export const listPatients = asyncHandler(async (req, res) => {
  const data = await service.listPatients(req.user.id);
  return ok(res, data);
});

export const today = asyncHandler(async (req, res) => {
  const data = await service.getTodaySchedule(req.user.id);
  return ok(res, data);
});

export const week = asyncHandler(async (req, res) => {
  const data = await service.getWeekSchedule(req.user.id, req.validated.query.start);
  return ok(res, data);
});

export const getById = asyncHandler(async (req, res) => {
  const data = await service.getAppointmentDetail(req.user.id, req.validated.params.id);
  return ok(res, data);
});

export const complete = asyncHandler(async (req, res) => {
  const data = await service.completeVisit(req.user.id, req.validated.params.id, req.validated.body);
  return created(res, data);
});

export const noShow = asyncHandler(async (req, res) => {
  const data = await service.markNoShow(req.user.id, req.validated.params.id);
  return ok(res, data);
});

export default { list, listPatients, today, week, getById, complete, noShow };
