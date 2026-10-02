// backend/modules/patients/patient.service.js
// Phase 4 — own profile + family members.
// [ENC] (ENCRYPTION_DESIGN §1, migration 004):
//   - patients: date_of_birth, blood_type, allergies, address, emergency_contact
//   - patient_family_members: full_name, relation
//   Encrypt on write, decrypt on read — PERO para sa owner lang (ang mga
//   route ay requireRole('patient') + JWT.sub scoping; ibang pasyente → 404).
//   Legacy/seed rows na plaintext: ibinabalik as-is (isEncrypted check).
//   NEVER i-log ang decrypted PHI values (ids/dates/statuses lang sa logs).

import ApiError from '../../shared/utils/ApiError.js';
import { decryptField, encryptField, isEncrypted } from '../../shared/utils/crypto.js';
import * as repo from './patient.repository.js';
import * as appointmentRepo from '../appointments/appointment.repository.js';

/** [ENC] columns ng patients. */
export const PATIENT_ENC_FIELDS = ['date_of_birth', 'blood_type', 'allergies', 'address', 'emergency_contact'];
/** [ENC] columns ng patient_family_members. */
export const FAMILY_ENC_FIELDS = ['full_name', 'relation'];

/**
 * I-encrypt ang [ENC] fields ng isang row bago i-save.
 * null/undefined ay mananatiling null/undefined; ang ibang fields ay
 * dumadaan lang. (Sync — ang crypto.js ay sync.)
 */
export function encryptRow(row, fields = PATIENT_ENC_FIELDS) {
  const out = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (v === undefined || v === null) continue;
    out[f] = encryptField(String(v));
  }
  return out;
}

/**
 * I-decrypt ang [ENC] fields ng isang row para sa owner.
 * Kapag ang value ay HINDI ciphertext (legacy/seed plaintext), ibinabalik
 * as-is — hindi nag-throw. null/undefined ay mananatili.
 * TOLERANT din sa v1:-prefixed na value na HINDI ma-decrypt ng kasalukuyang
 * ENCRYPTION_KEY (hal. seed/sample ciphertext na ginawa sa ibang key, o
 * placeholder tulad ng 'v1:seed'): ibinabalik ang raw value as-is imbis na
 * mag-500 ang buong read. Ang decryptField mismo ay nananatiling STRICT
 * (ang tamper detection ay nasa crypto layer; dito sa service layer ay
 * availability ang priority — ang owner ay nakikita ang sariling row).
 */
export function decryptRow(row, fields = PATIENT_ENC_FIELDS) {
  const out = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (v === undefined || v === null) continue;
    if (!isEncrypted(v)) continue; // legacy/seed plaintext — as-is
    try {
      out[f] = decryptField(v);
    } catch {
      // v1:-prefixed pero hindi ma-decrypt (ibang key / corrupt / sample
      // seed value) — huwag ibagsak ang read; raw value na lang.
      out[f] = v;
    }
  }
  return out;
}

export async function getProfile(patientId) {
  const row = await repo.getPatientById(patientId);
  if (!row) throw ApiError.notFound('Patient profile not found');
  return decryptRow(row);
}

export async function updateProfile(patientId, patch) {
  if (Object.keys(patch).length === 0) return getProfile(patientId); // no-op PUT
  const row = await repo.updatePatient(patientId, encryptRow(patch));
  return decryptRow(row);
}

export async function listFamily(patientId) {
  const rows = await repo.listFamilyMembers(patientId);
  return rows.map((r) => decryptRow(r, FAMILY_ENC_FIELDS));
}

export async function createFamilyMember(patientId, input) {
  const row = await repo.createFamilyMember(patientId, encryptRow(input, FAMILY_ENC_FIELDS));
  return decryptRow(row, FAMILY_ENC_FIELDS);
}

export async function updateFamilyMember(patientId, id, patch) {
  const existing = await repo.getFamilyMember(id, patientId);
  if (!existing) throw ApiError.notFound('Family member not found'); // ibang pasyente → 404, hindi 403
  if (Object.keys(patch).length === 0) return decryptRow(existing, FAMILY_ENC_FIELDS);
  const row = await repo.updateFamilyMember(id, patientId, encryptRow(patch, FAMILY_ENC_FIELDS));
  return decryptRow(row, FAMILY_ENC_FIELDS);
}

export async function deleteFamilyMember(patientId, id) {
  const existing = await repo.getFamilyMember(id, patientId);
  if (!existing) throw ApiError.notFound('Family member not found');
  // Guard (product decision 2026-10-02): hindi pwedeng i-delete ang member na
  // may upcoming appointment — i-cancel/i-reschedule muna. Ang match ay sa
  // booked_for name snapshot (walang family_member_id FK sa appointments).
  const member = decryptRow(existing, FAMILY_ENC_FIELDS);
  const upcoming = await appointmentRepo.countUpcomingForAttendee(patientId, member.full_name);
  if (upcoming > 0) {
    const plural = upcoming === 1 ? 'appointment' : 'appointments';
    throw ApiError.conflict(
      `Cannot delete ${member.full_name} — they still have ${upcoming} upcoming ${plural}. Cancel or reschedule ${upcoming === 1 ? 'the appointment' : 'the appointments'} first before removing the family member.`,
    );
  }
  await repo.deleteFamilyMember(id, patientId);
}

export default {
  PATIENT_ENC_FIELDS,
  FAMILY_ENC_FIELDS,
  encryptRow,
  decryptRow,
  getProfile,
  updateProfile,
  listFamily,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
};
