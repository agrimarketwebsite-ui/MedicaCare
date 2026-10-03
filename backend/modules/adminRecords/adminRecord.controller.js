// backend/modules/adminRecords/adminRecord.controller.js
// Phase 6 — Admin Console: labs & medications endpoints. Ang actor (admin
// email) ay nire-resolve nang isang beses bawat request para sa activity_log.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created, noContent } from '../../shared/utils/apiResponse.js';
import { actorEmail } from '../../shared/utils/activityLog.js';
import * as service from './adminRecord.service.js';

export const listLabResults = asyncHandler(async (req, res) => {
  const data = await service.listLabResults(req.validated.query.patient_id);
  return ok(res, data);
});

export const createLabResult = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.createLabResult(actor, req.validated.body);
  return created(res, data);
});

export const updateLabResult = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updateLabResult(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const deleteLabResult = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  await service.deleteLabResult(actor, req.validated.params.id);
  return noContent(res);
});

export const listMedications = asyncHandler(async (req, res) => {
  const data = await service.listMedications(req.validated.query.patient_id);
  return ok(res, data);
});

export const createMedication = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.createMedication(actor, req.validated.body);
  return created(res, data);
});

export const updateMedication = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  const data = await service.updateMedication(actor, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const deleteMedication = asyncHandler(async (req, res) => {
  const actor = await actorEmail(req.user.id);
  await service.deleteMedication(actor, req.validated.params.id);
  return noContent(res);
});

export default {
  listLabResults,
  createLabResult,
  updateLabResult,
  deleteLabResult,
  listMedications,
  createMedication,
  updateMedication,
  deleteMedication,
};
