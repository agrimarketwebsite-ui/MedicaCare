// backend/modules/adminRecords/adminRecord.repository.js
// Phase 6 — Admin Console: lab_results + medications persistence (admin
// scope — WALANG doctor-patient BOLA dito; ang access ay
// requireRole('admin')).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminRecord.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

// ---- lab_results ----

const LAB_COLS = 'id, patient_id, doctor_id, test_name, category, status, result_date, findings, created_at';

export async function listLabResults(patientId) {
  const { data, error } = await supabase
    .from('lab_results')
    .select(LAB_COLS)
    .eq('patient_id', patientId)
    .order('result_date', { ascending: false })
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listLabResults');
}

export async function createLabResult(row) {
  const { data, error } = await supabase
    .from('lab_results')
    .insert(row)
    .select(LAB_COLS)
    .single();
  return must({ data, error }, 'createLabResult');
}

export async function updateLabResult(id, patch) {
  const { data, error } = await supabase
    .from('lab_results')
    .update(patch)
    .eq('id', id)
    .select(LAB_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateLabResult');
}

export async function deleteLabResult(id) {
  const { data, error } = await supabase
    .from('lab_results')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[adminRecord.repository] deleteLabResult:', error.message);
    throw new Error('Database error (deleteLabResult)');
  }
  return Boolean(data);
}

// ---- medications ----

const MED_COLS =
  'id, patient_id, doctor_id, appointment_id, name, dose, form, frequency, start_date, status, instructions, created_at';

export async function listMedications(patientId) {
  const { data, error } = await supabase
    .from('medications')
    .select(MED_COLS)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listMedications');
}

export async function createMedication(row) {
  const { data, error } = await supabase
    .from('medications')
    .insert(row)
    .select(MED_COLS)
    .single();
  return must({ data, error }, 'createMedication');
}

export async function updateMedication(id, patch) {
  const { data, error } = await supabase
    .from('medications')
    .update(patch)
    .eq('id', id)
    .select(MED_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateMedication');
}

export async function deleteMedication(id) {
  const { data, error } = await supabase
    .from('medications')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[adminRecord.repository] deleteMedication:', error.message);
    throw new Error('Database error (deleteMedication)');
  }
  return Boolean(data);
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
