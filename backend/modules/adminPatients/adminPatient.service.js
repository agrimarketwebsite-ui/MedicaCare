// backend/modules/adminPatients/adminPatient.service.js
// Phase 6 — Admin Console: patient registry business logic.
// [ENC]: date_of_birth, blood_type, allergies, address, emergency_contact —
// encrypt on write, decrypt on read (mga helpers mula sa
// patients/patient.service.js). Ang password ay bcrypt (cost 12).
// NEVER i-log ang decrypted PHI values.

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import { hashPassword } from '../../shared/utils/passwords.js';
import {
  PATIENT_ENC_FIELDS,
  encryptRow,
  decryptRow,
} from '../patients/patient.service.js';
import * as repo from './adminPatient.repository.js';

export async function listPatients({ q, page, limit }) {
  const { rows, total } = await repo.listPatients({ q, page, limit });
  return { patients: rows.map((r) => decryptRow(r, PATIENT_ENC_FIELDS)), total, page, limit };
}

export async function getPatient(id) {
  const row = await repo.getPatientById(id);
  if (!row) throw ApiError.notFound('Patient not found');
  return { patient: decryptRow(row, PATIENT_ENC_FIELDS) };
}

export async function createPatient(actor, input) {
  const { password, ...rest } = input;
  try {
    const row = await repo.createPatient({
      ...encryptRow(rest, PATIENT_ENC_FIELDS),
      password_hash: await hashPassword(password),
    });
    await logActivity(actor, 'patient.create', `Created patient ${row.full_name} (${row.email})`);
    return { patient: decryptRow(row, PATIENT_ENC_FIELDS) };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('A patient with this email already exists.');
    }
    throw err;
  }
}

export async function updatePatient(actor, id, patch) {
  const row = await repo.updatePatient(id, encryptRow(patch, PATIENT_ENC_FIELDS));
  if (!row) throw ApiError.notFound('Patient not found');
  await logActivity(actor, 'patient.update', `Updated patient ${row.full_name} (${row.email})`);
  return { patient: decryptRow(row, PATIENT_ENC_FIELDS) };
}

export async function deletePatient(actor, id) {
  const deleted = await repo.deletePatient(id);
  if (!deleted) throw ApiError.notFound('Patient not found');
  await logActivity(actor, 'patient.delete', `Deleted patient ${id}`);
  return true;
}

export default {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
};
