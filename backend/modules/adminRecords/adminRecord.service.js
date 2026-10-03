// backend/modules/adminRecords/adminRecord.service.js
// Phase 6 — Admin Console: labs & medications encoding business logic.
// [ENC] (mirror ng records module):
//   - lab_results: test_name, findings (findings = JSON string ng ciphertext)
//   - medications: name, dose, instructions
// Encrypt on write, decrypt on read. Ang doctor_id ay NULL sa admin-created
// rows (hindi galing sa isang doctor account).

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import {
  LAB_RESULT_ENC_FIELDS,
  MEDICATION_ENC_FIELDS,
  encryptRow,
  encryptFindings,
  decryptRow,
} from '../records/record.service.js';
import * as repo from './adminRecord.repository.js';

// ---- lab_results ----

export async function listLabResults(patientId) {
  const rows = await repo.listLabResults(patientId);
  return { lab_results: rows.map((r) => decryptRow(r, LAB_RESULT_ENC_FIELDS)) };
}

export async function createLabResult(actor, input) {
  const { patient_id, findings, ...rest } = input;
  const row = await repo.createLabResult({
    patient_id,
    doctor_id: null,
    ...encryptRow(rest, ['test_name']),
    findings: encryptFindings(findings),
  });
  await logActivity(actor, 'lab.create', `Added lab result "${input.test_name}" for patient ${patient_id}`);
  return { lab_result: decryptRow(row, LAB_RESULT_ENC_FIELDS) };
}

export async function updateLabResult(actor, id, patch) {
  const { findings, ...rest } = patch;
  const encrypted = { ...encryptRow(rest, ['test_name']) };
  if (findings !== undefined) encrypted.findings = encryptFindings(findings);
  const row = await repo.updateLabResult(id, encrypted);
  if (!row) throw ApiError.notFound('Lab result not found');
  await logActivity(actor, 'lab.update', `Updated lab result ${id}`);
  return { lab_result: decryptRow(row, LAB_RESULT_ENC_FIELDS) };
}

export async function deleteLabResult(actor, id) {
  const deleted = await repo.deleteLabResult(id);
  if (!deleted) throw ApiError.notFound('Lab result not found');
  await logActivity(actor, 'lab.delete', `Deleted lab result ${id}`);
  return true;
}

// ---- medications ----

export async function listMedications(patientId) {
  const rows = await repo.listMedications(patientId);
  return { medications: rows.map((r) => decryptRow(r, MEDICATION_ENC_FIELDS)) };
}

export async function createMedication(actor, input) {
  const { patient_id, doctor_id, appointment_id, ...rest } = input;
  const row = await repo.createMedication({
    patient_id,
    doctor_id,
    appointment_id: appointment_id ?? null,
    ...encryptRow(rest, MEDICATION_ENC_FIELDS),
  });
  await logActivity(actor, 'medication.create', `Added medication "${input.name}" for patient ${patient_id}`);
  return { medication: decryptRow(row, MEDICATION_ENC_FIELDS) };
}

export async function updateMedication(actor, id, patch) {
  const row = await repo.updateMedication(id, encryptRow(patch, MEDICATION_ENC_FIELDS));
  if (!row) throw ApiError.notFound('Medication not found');
  await logActivity(actor, 'medication.update', `Updated medication ${id}`);
  return { medication: decryptRow(row, MEDICATION_ENC_FIELDS) };
}

export async function deleteMedication(actor, id) {
  const deleted = await repo.deleteMedication(id);
  if (!deleted) throw ApiError.notFound('Medication not found');
  await logActivity(actor, 'medication.delete', `Deleted medication ${id}`);
  return true;
}

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
