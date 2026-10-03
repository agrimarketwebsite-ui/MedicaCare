// backend/modules/adminDoctors/adminDoctor.controller.js
// Phase 6 — Admin Console: doctors endpoints. Ang actor (admin email) ay
// nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created, noContent } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminDoctor.service.js';

export const listDoctors = asyncHandler(async (req, res) => {
  const { q, specialty, page, limit } = req.validated.query;
  const result = await service.listDoctors({ q, specialty, page, limit });
  return ok(res, result, { total: result.total, page, limit });
});

export const getDoctor = asyncHandler(async (req, res) => {
  const data = await service.getDoctor(req.validated.params.id);
  return ok(res, data);
});

export const createDoctor = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.createDoctor(actor, req.validated.body);
  return created(res, data);
});

export const updateDoctor = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updateDoctor(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const deleteDoctor = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  await service.deleteDoctor(actor, req.validated.params.id);
  return noContent(res);
});

export const listAvailability = asyncHandler(async (req, res) => {
  const data = await service.listAvailability(req.validated.params.id);
  return ok(res, data);
});

export const addAvailability = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.addAvailability(actor, req.validated.params.id, req.validated.body);
  return created(res, data);
});

export const editAvailability = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const { id, availId } = req.validated.params;
  const data = await service.editAvailability(actor, id, availId, req.validated.body);
  return ok(res, data);
});

export const removeAvailability = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const { id, availId } = req.validated.params;
  await service.removeAvailability(actor, id, availId);
  return noContent(res);
});

export const grantPortalAccess = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.grantPortalAccess(actor, req.validated.params.id, req.validated.body);
  return created(res, data);
});

export const resetPortalAccess = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.resetPortalAccess(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const revokePortalAccess = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  await service.revokePortalAccess(actor, req.validated.params.id);
  return noContent(res);
});

export default {
  listDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  listAvailability,
  addAvailability,
  editAvailability,
  removeAvailability,
  grantPortalAccess,
  resetPortalAccess,
  revokePortalAccess,
};
