// backend/modules/records/record.repository.js
// Phase 5 — medical_records / lab_results / medications persistence.
// BOLA: ang service ay nag-e-ensure na ang patient ay "pasyente ng doctor"
// (may non-cancelled appointment sa kanya) bago ang anumang read/write.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[record.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

/**
 * May relasyon ba ang doctor at patient? I.e., may ≥1 appointment ang
 * patient sa doctor na ito na hindi cancelled. Ito ang "na-attendan"
 * boundary ng Phase 5 (hindi buong patient directory).
 */
export async function hasDoctorPatientRelation(doctorId, patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('patient_id', patientId)
    .neq('status', 'cancelled')
    .limit(1);
  const rows = must({ data, error }, 'hasDoctorPatientRelation');
  return rows.length > 0;
}

export async function getPatientById(patientId) {
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('id', patientId)
    .maybeSingle();
  return must({ data, error }, 'getPatientById');
}

// ---- medical_records ----

const MEDICAL_COLS =
  'id, patient_id, doctor_id, appointment_id, visit_date, record_type, title, summary, created_at';

export async function createMedicalRecord(row) {
  const { data, error } = await supabase.from('medical_records').insert(row).select(MEDICAL_COLS).single();
  return must({ data, error }, 'createMedicalRecord');
}

export async function listMedicalRecords(patientId) {
  const { data, error } = await supabase
    .from('medical_records')
    .select(MEDICAL_COLS)
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listMedicalRecords');
}

/** Scoped sa sariling doctor_id — null kapag hindi kanya (→ 404). */
export async function updateMedicalRecord(doctorId, id, patch) {
  const { data, error } = await supabase
    .from('medical_records')
    .update(patch)
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .select(MEDICAL_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateMedicalRecord');
}

// ---- lab_results ----

const LAB_COLS = 'id, patient_id, doctor_id, test_name, category, status, result_date, findings, created_at';

export async function createLabResult(row) {
  const { data, error } = await supabase.from('lab_results').insert(row).select(LAB_COLS).single();
  return must({ data, error }, 'createLabResult');
}

export async function listLabResults(patientId) {
  const { data, error } = await supabase
    .from('lab_results')
    .select(LAB_COLS)
    .eq('patient_id', patientId)
    .order('result_date', { ascending: false })
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listLabResults');
}

// ---- medications ----

const MED_COLS =
  'id, patient_id, doctor_id, appointment_id, name, dose, form, frequency, start_date, status, instructions, created_at';

export async function createMedication(row) {
  const { data, error } = await supabase.from('medications').insert(row).select(MED_COLS).single();
  return must({ data, error }, 'createMedication');
}

export async function listMedications(patientId) {
  const { data, error } = await supabase
    .from('medications')
    .select(MED_COLS)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listMedications');
}

export default {
  hasDoctorPatientRelation,
  getPatientById,
  createMedicalRecord,
  listMedicalRecords,
  updateMedicalRecord,
  createLabResult,
  listLabResults,
  createMedication,
  listMedications,
};
