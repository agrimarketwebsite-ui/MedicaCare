// backend/modules/adminDoctors/adminDoctor.service.js
// Phase 6 — Admin Console: doctors business logic (CRUD + availability +
// portal access). Ang portal password ay bcrypt (cost 12). Bawat mutating
// action ay may activity_log write.

import { randomBytes } from 'node:crypto';
import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import { hashPassword } from '../../shared/utils/passwords.js';
import * as repo from './adminDoctor.repository.js';

async function assertDoctor(id) {
  const row = await repo.getDoctorById(id);
  if (!row) throw ApiError.notFound('Doctor not found');
  return row;
}

export async function listDoctors({ q, specialty, page, limit }) {
  const { rows, total } = await repo.listDoctors({ q, specialtyId: specialty, page, limit });
  const doctors = rows.map((r) => {
    const portal = Array.isArray(r.doctor_accounts) ? r.doctor_accounts[0] : r.doctor_accounts;
    const rest = { ...r };
    delete rest.doctor_accounts;
    return { ...rest, has_portal_access: !!portal?.email, portal_email: portal?.email || null };
  });
  return { doctors, total, page, limit };
}

export async function getDoctor(id) {
  const doctor = await assertDoctor(id);
  const portal = await repo.getPortalAccountByDoctorId(id);
  return { doctor, portal_access: portal ? { email: portal.email, granted_at: portal.created_at } : null };
}

export async function createDoctor(actor, input) {
  const row = await repo.createDoctor(input);
  await logActivity(actor, 'doctor.create', `Created doctor ${row.full_name}`);
  return { doctor: row };
}

export async function updateDoctor(actor, id, patch) {
  const row = await repo.updateDoctor(id, patch);
  if (!row) throw ApiError.notFound('Doctor not found');
  await logActivity(actor, 'doctor.update', `Updated doctor ${row.full_name}`);
  return { doctor: row };
}

export async function deleteDoctor(actor, id) {
  const deleted = await repo.deleteDoctor(id);
  if (!deleted) throw ApiError.notFound('Doctor not found');
  await logActivity(actor, 'doctor.delete', `Deleted doctor ${id}`);
  return true;
}

// ---- availability ----

export async function listAvailability(doctorId) {
  await assertDoctor(doctorId);
  const availability = await repo.listAvailability(doctorId);
  return { availability };
}

export async function addAvailability(actor, doctorId, input) {
  const doctor = await assertDoctor(doctorId);
  try {
    const row = await repo.createAvailability(doctorId, input);
    await logActivity(
      actor,
      'availability.add',
      `Added availability for Dr. ${doctor.full_name}: weekday ${input.weekday} ${input.start_time}–${input.end_time}`,
    );
    return { availability: row };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('An availability entry already exists for this weekday and start time.');
    }
    throw err;
  }
}

export async function editAvailability(actor, doctorId, availId, patch) {
  const doctor = await assertDoctor(doctorId);
  try {
    const row = await repo.updateAvailability(doctorId, availId, patch);
    if (!row) throw ApiError.notFound('Availability entry not found');
    await logActivity(actor, 'availability.edit', `Edited availability for Dr. ${doctor.full_name} (${availId})`);
    return { availability: row };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.code === '23505') {
      throw ApiError.conflict('An availability entry already exists for this weekday and start time.');
    }
    throw err;
  }
}

export async function removeAvailability(actor, doctorId, availId) {
  const doctor = await assertDoctor(doctorId);
  const deleted = await repo.deleteAvailability(doctorId, availId);
  if (!deleted) throw ApiError.notFound('Availability entry not found');
  await logActivity(actor, 'availability.delete', `Removed availability for Dr. ${doctor.full_name} (${availId})`);
  return true;
}

// ---- portal access ----

export async function grantPortalAccess(actor, doctorId, { email, password }) {
  const doctor = await assertDoctor(doctorId);
  try {
    const account = await repo.createPortalAccount({
      doctor_id: doctorId,
      email,
      password_hash: await hashPassword(password),
    });
    await logActivity(actor, 'portal.grant', `Granted portal access to Dr. ${doctor.full_name} (${email})`);
    return { portal_access: { email: account.email, granted_at: account.created_at } };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('This email is already in use or the doctor already has portal access.');
    }
    throw err;
  }
}

export async function resetPortalAccess(actor, doctorId) {
  const doctor = await assertDoctor(doctorId);
  const account = await repo.getPortalAccountByDoctorId(doctorId);
  if (!account) throw ApiError.notFound('This doctor has no portal account');
  // Server-generated temporary password — ibabalik sa response para
  // maibigay ng admin sa doctor (hindi ipinapadala sa request).
  const password = randomBytes(9).toString('base64url');
  await repo.updatePortalAccountPassword(account.id, await hashPassword(password));
  await logActivity(actor, 'portal.reset', `Reset portal password for Dr. ${doctor.full_name} (${account.email})`);
  return { portal_access: { email: account.email }, password };
}

export async function revokePortalAccess(actor, doctorId) {
  const doctor = await assertDoctor(doctorId);
  const account = await repo.getPortalAccountByDoctorId(doctorId);
  if (!account) throw ApiError.notFound('This doctor has no portal account');
  await repo.deletePortalAccountAndSessions(account.id);
  await logActivity(actor, 'portal.revoke', `Revoked portal access of Dr. ${doctor.full_name} (${account.email})`);
  return true;
}

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
