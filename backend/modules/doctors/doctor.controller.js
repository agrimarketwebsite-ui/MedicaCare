// backend/modules/doctors/doctor.controller.js
// Phase 3 — GET /api/doctors (list), /specialties, /:id.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import * as service from './doctor.service.js';

export const listDoctors = asyncHandler(async (req, res) => {
  const data = await service.listDoctors(req.validated.query);
  return ok(res, data);
});

export const listSpecialties = asyncHandler(async (_req, res) => {
  const data = await service.listSpecialties();
  return ok(res, data);
});

export const getDoctorById = asyncHandler(async (req, res) => {
  const data = await service.getDoctorById(req.validated.params.id);
  return ok(res, data);
});

export default { listDoctors, listSpecialties, getDoctorById };
