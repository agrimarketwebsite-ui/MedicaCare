// backend/modules/adminPatients/adminPatient.controller.js
// Phase 6 — Admin Console: patient registry endpoints.
// Ang actor (admin email) ay nire-resolve nang isang beses bawat request at
// ipinapasa sa service para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created, noContent } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminPatient.service.js';

export const listPatients = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.validated.query;
  const result = await service.listPatients({ q, page, limit });
  return ok(res, result, { total: result.total, page, limit });
});

export const getPatient = asyncHandler(async (req, res) => {
  const data = await service.getPatient(req.validated.params.id);
  return ok(res, data);
});

export const createPatient = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.createPatient(actor, req.validated.body);
  return created(res, data);
});

export const updatePatient = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updatePatient(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const deletePatient = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  await service.deletePatient(actor, req.validated.params.id);
  return noContent(res);
});

export default {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
};
