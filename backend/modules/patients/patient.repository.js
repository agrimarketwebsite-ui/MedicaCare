// backend/modules/patients/patient.repository.js
// Phase 4 — patient profile + family members.
// BOLA (API1): LAHAT ng queries ay naka-scope sa patient id na galing sa JWT
// (ipinapasa ng service) — hindi kailanman galing sa body/params.
// Ang [ENC] fields ay NAKA-ENCRYPT na pagdating dito (ang service ang
// nag-encrypt via crypto.js); ang repository ay hindi nagde-decrypt.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[patient.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

// Explicit columns — ang password_hash ay HINDI kailanman sine-select.
export const PATIENT_COLS =
  'id, full_name, email, phone, gender, date_of_birth, blood_type, allergies, address, emergency_contact, photo_url, email_reminders, portal_notifications, last_visit_date, created_at, updated_at';

export async function getPatientById(id) {
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLS)
    .eq('id', id)
    .maybeSingle();
  return must({ data, error }, 'getPatientById');
}

export async function updatePatient(id, patch) {
  const { data, error } = await supabase
    .from('patients')
    .update(patch)
    .eq('id', id)
    .select(PATIENT_COLS)
    .single();
  return must({ data, error }, 'updatePatient');
}

const FAMILY_COLS = 'id, patient_id, full_name, relation, age, created_at';

export async function listFamilyMembers(patientId) {
  const { data, error } = await supabase
    .from('patient_family_members')
    .select(FAMILY_COLS)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  return must({ data, error }, 'listFamilyMembers');
}

/** Ownership-scoped read — null kapag hindi pag-aari ng pasyente (→ 404). */
export async function getFamilyMember(id, patientId) {
  const { data, error } = await supabase
    .from('patient_family_members')
    .select(FAMILY_COLS)
    .eq('id', id)
    .eq('patient_id', patientId)
    .maybeSingle();
  return must({ data, error }, 'getFamilyMember');
}

export async function createFamilyMember(patientId, { full_name, relation, age }) {
  const { data, error } = await supabase
    .from('patient_family_members')
    .insert({ patient_id: patientId, full_name, relation, age: age ?? null })
    .select(FAMILY_COLS)
    .single();
  return must({ data, error }, 'createFamilyMember');
}

export async function updateFamilyMember(id, patientId, patch) {
  const { data, error } = await supabase
    .from('patient_family_members')
    .update(patch)
    .eq('id', id)
    .eq('patient_id', patientId)
    .select(FAMILY_COLS)
    .single();
  return must({ data, error }, 'updateFamilyMember');
}

export async function deleteFamilyMember(id, patientId) {
  const { error } = await supabase
    .from('patient_family_members')
    .delete()
    .eq('id', id)
    .eq('patient_id', patientId);
  must({ data: null, error }, 'deleteFamilyMember');
}

export default {
  getPatientById,
  updatePatient,
  listFamilyMembers,
  getFamilyMember,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
};
