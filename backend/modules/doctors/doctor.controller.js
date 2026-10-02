// backend/modules/doctors/doctor.controller.js
// Phase 3 — GET /api/doctors (list), /specialties, /:id.
// Phase 5 — doctor portal: GET /me/profile, /me/availability CRUD
// (requireRole('doctor'); BOLA sa service via resolveDoctorId).

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created, ok, noContent } from '../../shared/utils/apiResponse.js';
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

// ---- Phase 5: own profile + weekly availability ----

export const getOwnProfile = asyncHandler(async (req, res) => {
  const data = await service.getOwnProfile(req.user.id);
  return ok(res, data);
});

export const listOwnAvailability = asyncHandler(async (req, res) => {
  const data = await service.listOwnAvailability(req.user.id);
  return ok(res, data);
});

export const createAvailability = asyncHandler(async (req, res) => {
  const data = await service.createAvailability(req.user.id, req.validated.body);
  return created(res, data);
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const data = await service.updateAvailability(req.user.id, req.validated.params.availId, req.validated.body);
  return ok(res, data);
});

export const deleteAvailability = asyncHandler(async (req, res) => {
  await service.deleteAvailability(req.user.id, req.validated.params.availId);
  return noContent(res);
});

export default {
  listDoctors,
  listSpecialties,
  getDoctorById,
  getOwnProfile,
  listOwnAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
};
