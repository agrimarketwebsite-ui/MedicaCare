// backend/modules/adminPatients/adminPatient.repository.js
// Phase 6 — Admin Console: patient registry persistence (admin scope —
// WALANG patient-level BOLA dito; ang access ay requireRole('admin')).

import { supabase } from '../../config/db.js';
import { PATIENT_COLS } from '../patients/patient.repository.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminPatient.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

export async function listPatients({ q, page, limit }) {
  let query = supabase.from('patients').select(PATIENT_COLS, { count: 'exact' });
  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const offset = (page - 1) * limit;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  must({ data, error }, 'listPatients');
  return { rows: data, total: count ?? data.length };
}

export async function getPatientById(id) {
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLS)
    .eq('id', id)
    .maybeSingle();
  return must({ data, error }, 'getPatientById');
}

export async function createPatient(row) {
  const { data, error } = await supabase
    .from('patients')
    .insert(row)
    .select(PATIENT_COLS)
    .single();
  if (error) {
    console.error('[adminPatient.repository] createPatient:', error.message);
    const err = new Error('Database error (createPatient)');
    err.code = error.code; // 23505 = email unique → 409
    throw err;
  }
  return data;
}

export async function updatePatient(id, patch) {
  const { data, error } = await supabase
    .from('patients')
    .update(patch)
    .eq('id', id)
    .select(PATIENT_COLS)
    .maybeSingle();
  return must({ data, error }, 'updatePatient');
}

/** Hard delete — false kapag hindi nakita (→ 404). */
export async function deletePatient(id) {
  const { data, error } = await supabase
    .from('patients')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[adminPatient.repository] deletePatient:', error.message);
    throw new Error('Database error (deletePatient)');
  }
  return Boolean(data);
}

export default {
  listPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
};
