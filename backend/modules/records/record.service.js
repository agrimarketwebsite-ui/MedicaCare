// backend/modules/records/record.service.js
// Phase 5 — doctor-written records: medical_records, lab_results, medications.
// [ENC] (AES-256-GCM, crypto.js — encryptRow/decryptRow pattern ng
// patients/patient.service.js):
//   - medical_records: title, summary
//   - lab_results: test_name, findings (ang findings ay jsonb — sa backend
//     path ay itinatago bilang JSON string ng base64 ciphertext, ayon sa
//     schema playbook; sa read ay dini-decrypt tapos JSON.parse)
//   - medications: name, dose, instructions
// Encrypt on write, decrypt on read — para sa doctor lang na may relasyon sa
// patient (may non-cancelled appointment sa kanya; hindi buong directory).
// NEVER i-log ang decrypted values.

import ApiError from '../../shared/utils/ApiError.js';
import { decryptField, encryptField, isEncrypted } from '../../shared/utils/crypto.js';
import { resolveDoctorId } from '../doctors/doctor.service.js';
import * as repo from './record.repository.js';

/** [ENC] columns ng medical_records. */
export const MEDICAL_RECORD_ENC_FIELDS = ['title', 'summary'];
/** [ENC] columns ng lab_results (findings = JSON string ng ciphertext). */
export const LAB_RESULT_ENC_FIELDS = ['test_name', 'findings'];
/** [ENC] columns ng medications. */
export const MEDICATION_ENC_FIELDS = ['name', 'dose', 'instructions'];

export function encryptRow(row, fields) {
  const out = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (v === undefined || v === null) continue;
    out[f] = encryptField(String(v));
  }
  return out;
}

/** I-encrypt ang findings array bilang JSON string ng base64 ciphertext. */
export function encryptFindings(findings) {
  return encryptField(JSON.stringify(findings ?? []));
}

/**
 * I-decrypt ang findings: v1: ciphertext → JSON.parse → array; legacy JSON
 * array (plaintext) ay as-is; corrupt/unparseable ay raw as-is (hindi 500).
 */
export function decryptFindings(value) {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value; // legacy plaintext array — as-is
  if (!isEncrypted(value)) return value;
  try {
    const parsed = JSON.parse(decryptField(value));
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export function decryptRow(row, fields) {
  const out = { ...row };
  for (const f of fields) {
    const v = out[f];
    if (v === undefined || v === null) continue;
    if (f === 'findings') {
      out[f] = decryptFindings(v);
      continue;
    }
    if (!isEncrypted(v)) continue; // legacy/seed plaintext — as-is
    try {
      out[f] = decryptField(v);
    } catch {
      out[f] = v; // ibang key / corrupt — huwag ibagsak ang read
    }
  }
  return out;
}

/**
 * I-verify na ang patient ay pasyente ng doctor na ito (may non-cancelled
 * appointment sa kanya). Hindi kilala o hindi kanya → 404 (walang info leak).
 */
async function assertDoctorPatient(doctorId, patientId) {
  const patient = await repo.getPatientById(patientId);
  if (!patient) throw ApiError.notFound('Patient not found');
  const related = await repo.hasDoctorPatientRelation(doctorId, patientId);
  if (!related) throw ApiError.notFound('Patient not found');
  return patient;
}

// ---- medical_records ----

export async function createMedicalRecord(accountId, input) {
  const doctorId = await resolveDoctorId(accountId);
  await assertDoctorPatient(doctorId, input.patient_id);
  const row = await repo.createMedicalRecord({
    ...encryptRow(input, MEDICAL_RECORD_ENC_FIELDS),
    doctor_id: doctorId,
  });
  return { record: decryptRow(row, MEDICAL_RECORD_ENC_FIELDS) };
}

export async function listMedicalRecords(accountId, patientId) {
  const doctorId = await resolveDoctorId(accountId);
  await assertDoctorPatient(doctorId, patientId);
  const rows = await repo.listMedicalRecords(patientId);
  return { records: rows.map((r) => decryptRow(r, MEDICAL_RECORD_ENC_FIELDS)) };
}

/** Amend: sariling record lang ng doctor ang pwedeng baguhin (→ 404 kung hindi). */
export async function updateMedicalRecord(accountId, id, patch) {
  const doctorId = await resolveDoctorId(accountId);
  const row = await repo.updateMedicalRecord(
    doctorId,
    id,
    encryptRow(patch, MEDICAL_RECORD_ENC_FIELDS),
  );
  if (!row) throw ApiError.notFound('Medical record not found');
  return { record: decryptRow(row, MEDICAL_RECORD_ENC_FIELDS) };
}

// ---- lab_results ----

export async function createLabResult(accountId, input) {
  const doctorId = await resolveDoctorId(accountId);
  await assertDoctorPatient(doctorId, input.patient_id);
  const { findings, ...rest } = input;
  const row = await repo.createLabResult({
    ...encryptRow(rest, ['test_name']),
    findings: encryptFindings(findings),
    doctor_id: doctorId,
  });
  return { lab_result: decryptRow(row, LAB_RESULT_ENC_FIELDS) };
}

export async function listLabResults(accountId, patientId) {
  const doctorId = await resolveDoctorId(accountId);
  await assertDoctorPatient(doctorId, patientId);
  const rows = await repo.listLabResults(patientId);
  return { lab_results: rows.map((r) => decryptRow(r, LAB_RESULT_ENC_FIELDS)) };
}

// ---- medications ----

export async function createMedication(accountId, input) {
  const doctorId = await resolveDoctorId(accountId);
  await assertDoctorPatient(doctorId, input.patient_id);
  const row = await repo.createMedication({
    ...encryptRow(input, MEDICATION_ENC_FIELDS),
    doctor_id: doctorId,
  });
  return { medication: decryptRow(row, MEDICATION_ENC_FIELDS) };
}

export async function listMedications(accountId, patientId) {
  const doctorId = await resolveDoctorId(accountId);
  await assertDoctorPatient(doctorId, patientId);
  const rows = await repo.listMedications(patientId);
  return { medications: rows.map((r) => decryptRow(r, MEDICATION_ENC_FIELDS)) };
}

export default {
  MEDICAL_RECORD_ENC_FIELDS,
  LAB_RESULT_ENC_FIELDS,
  MEDICATION_ENC_FIELDS,
  encryptRow,
  decryptRow,
  encryptFindings,
  decryptFindings,
  createMedicalRecord,
  listMedicalRecords,
  updateMedicalRecord,
  createLabResult,
  listLabResults,
  createMedication,
  listMedications,
};
