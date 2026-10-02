// backend/modules/records/record.controller.js
// Phase 5 — doctor-written records endpoints. Lahat ay requireRole('doctor').

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created, ok } from '../../shared/utils/apiResponse.js';
import * as service from './record.service.js';

export const createMedical = asyncHandler(async (req, res) => {
  const data = await service.createMedicalRecord(req.user.id, req.validated.body);
  return created(res, data);
});

export const listMedical = asyncHandler(async (req, res) => {
  const data = await service.listMedicalRecords(req.user.id, req.validated.query.patient_id);
  return ok(res, data);
});

export const updateMedical = asyncHandler(async (req, res) => {
  const data = await service.updateMedicalRecord(req.user.id, req.validated.params.id, req.validated.body);
  return ok(res, data);
});

export const createLab = asyncHandler(async (req, res) => {
  const data = await service.createLabResult(req.user.id, req.validated.body);
  return created(res, data);
});

export const listLab = asyncHandler(async (req, res) => {
  const data = await service.listLabResults(req.user.id, req.validated.query.patient_id);
  return ok(res, data);
});

export const createMedication = asyncHandler(async (req, res) => {
  const data = await service.createMedication(req.user.id, req.validated.body);
  return created(res, data);
});

export const listMedications = asyncHandler(async (req, res) => {
  const data = await service.listMedications(req.user.id, req.validated.query.patient_id);
  return ok(res, data);
});

export default {
  createMedical,
  listMedical,
  updateMedical,
  createLab,
  listLab,
  createMedication,
  listMedications,
};
