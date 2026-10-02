// backend/modules/patients/patient.controller.js
// Phase 4 — GET/PUT /api/patients/me + family CRUD.
// Ang patient id ay laging galing sa JWT (req.user.id) — hindi sa params.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created, noContent, ok } from '../../shared/utils/apiResponse.js';
import * as service from './patient.service.js';

export const getMe = asyncHandler(async (req, res) => {
  const patient = await service.getProfile(req.user.id);
  return ok(res, { patient });
});

export const updateMe = asyncHandler(async (req, res) => {
  const patient = await service.updateProfile(req.user.id, req.validated.body);
  return ok(res, { patient });
});

export const listFamily = asyncHandler(async (req, res) => {
  const family = await service.listFamily(req.user.id);
  return ok(res, { family });
});

export const createFamily = asyncHandler(async (req, res) => {
  const member = await service.createFamilyMember(req.user.id, req.validated.body);
  return created(res, { member });
});

export const updateFamily = asyncHandler(async (req, res) => {
  const member = await service.updateFamilyMember(
    req.user.id,
    req.validated.params.id,
    req.validated.body,
  );
  return ok(res, { member });
});

export const deleteFamily = asyncHandler(async (req, res) => {
  await service.deleteFamilyMember(req.user.id, req.validated.params.id);
  return noContent(res);
});

export default { getMe, updateMe, listFamily, createFamily, updateFamily, deleteFamily };
