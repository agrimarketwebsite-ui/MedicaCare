// backend/modules/appointments/appointment.controller.js
// Phase 4 — slots + booking + list/detail + reschedule + cancel.
// Ang patient id ay laging galing sa JWT (req.user.id) — hindi sa params.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created, ok } from '../../shared/utils/apiResponse.js';
import * as service from './appointment.service.js';

export const getSlots = asyncHandler(async (req, res) => {
  const { doctor_id, date, duration } = req.validated.query;
  const slots = await service.getSlots(doctor_id, date, duration);
  return ok(res, { slots });
});

export const create = asyncHandler(async (req, res) => {
  const appointment = await service.createAppointment(req.user.id, req.validated.body);
  return created(res, { appointment });
});

export const list = asyncHandler(async (req, res) => {
  const appointments = await service.listAppointments(req.user.id, req.validated.query);
  return ok(res, { appointments });
});

export const getById = asyncHandler(async (req, res) => {
  const appointment = await service.getAppointment(req.user.id, req.validated.params.id);
  return ok(res, { appointment });
});

export const reschedule = asyncHandler(async (req, res) => {
  const appointment = await service.rescheduleAppointment(
    req.user.id,
    req.validated.params.id,
    req.validated.body,
  );
  return ok(res, { appointment });
});

export const cancel = asyncHandler(async (req, res) => {
  const appointment = await service.cancelAppointment(req.user.id, req.validated.params.id);
  return ok(res, { appointment });
});

export default { getSlots, create, list, getById, reschedule, cancel };
