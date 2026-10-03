// backend/modules/adminDoctors/adminDoctor.repository.js
// Phase 6 — Admin Console: doctors persistence (CRUD + weekly availability +
// doctor_accounts portal access). Ang delete ng doctor ay CASCADE sa
// doctor_accounts (DB) — ang refresh_tokens ay nililinis nang eksplisito sa
// portal-access revoke.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminDoctor.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const DOCTOR_COLS =
  'id, full_name, specialty_id, status, years_of_experience, consultation_fee, room, gender, photo_url, specialties(name), doctor_accounts(email)';

export async function listDoctors({ q, specialtyId, page, limit }) {
  let query = supabase.from('doctors').select(DOCTOR_COLS, { count: 'exact' });
  if (q) query = query.ilike('full_name', `%${q}%`);
  if (specialtyId) query = query.eq('specialty_id', specialtyId);
  const offset = (page - 1) * limit;
  const { data, error, count } = await query
    .order('full_name', { ascending: true })
    .range(offset, offset + limit - 1);
  must({ data, error }, 'listDoctors');
  return { rows: data, total: count ?? data.length };
}

export async function getDoctorById(id) {
  const { data, error } = await supabase
    .from('doctors')
    .select(DOCTOR_COLS)
    .eq('id', id)
    .maybeSingle();
  return must({ data, error }, 'getDoctorById');
}

export async function createDoctor(row) {
  const { data, error } = await supabase
    .from('doctors')
    .insert(row)
    .select(DOCTOR_COLS)
    .single();
  if (error) {
    console.error('[adminDoctor.repository] createDoctor:', error.message);
    const err = new Error('Database error (createDoctor)');
    err.code = error.code;
    throw err;
  }
  return data;
}

export async function updateDoctor(id, patch) {
  const { data, error } = await supabase
    .from('doctors')
    .update(patch)
    .eq('id', id)
    .select(DOCTOR_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateDoctor');
}

export async function deleteDoctor(id) {
  const { data, error } = await supabase
    .from('doctors')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[adminDoctor.repository] deleteDoctor:', error.message);
    throw new Error('Database error (deleteDoctor)');
  }
  return Boolean(data);
}

// ---- weekly availability ----

const AVAIL_COLS = 'id, doctor_id, weekday, start_time, end_time';

export async function listAvailability(doctorId) {
  const { data, error } = await supabase
    .from('doctor_weekly_availability')
    .select(AVAIL_COLS)
    .eq('doctor_id', doctorId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });
  return must({ data, error }, 'listAvailability');
}

export async function createAvailability(doctorId, { weekday, start_time, end_time }) {
  const { data, error } = await supabase
    .from('doctor_weekly_availability')
    .insert({ doctor_id: doctorId, weekday, start_time, end_time })
    .select(AVAIL_COLS)
    .single();
  if (error) {
    console.error('[adminDoctor.repository] createAvailability:', error.message);
    const err = new Error('Database error (createAvailability)');
    err.code = error.code; // 23505 = unique(doctor_id, weekday, start_time) → 409
    throw err;
  }
  return data;
}

export async function updateAvailability(doctorId, id, patch) {
  const { data, error } = await supabase
    .from('doctor_weekly_availability')
    .update(patch)
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .select(AVAIL_COLS)
    .maybeSingle();
  if (error) {
    console.error('[adminDoctor.repository] updateAvailability:', error.message);
    const err = new Error('Database error (updateAvailability)');
    err.code = error.code;
    throw err;
  }
  return data;
}

export async function deleteAvailability(doctorId, id) {
  const { data, error } = await supabase
    .from('doctor_weekly_availability')
    .delete()
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[adminDoctor.repository] deleteAvailability:', error.message);
    throw new Error('Database error (deleteAvailability)');
  }
  return Boolean(data);
}

// ---- portal access (doctor_accounts) ----

export async function getPortalAccountByDoctorId(doctorId) {
  const { data, error } = await supabase
    .from('doctor_accounts')
    .select('id, doctor_id, email, created_at')
    .eq('doctor_id', doctorId)
    .maybeSingle();
  return must({ data, error }, 'getPortalAccountByDoctorId');
}

export async function createPortalAccount({ doctor_id, email, password_hash }) {
  const { data, error } = await supabase
    .from('doctor_accounts')
    .insert({ doctor_id, email, password_hash })
    .select('id, doctor_id, email, created_at')
    .single();
  if (error) {
    console.error('[adminDoctor.repository] createPortalAccount:', error.message);
    const err = new Error('Database error (createPortalAccount)');
    err.code = error.code; // 23505 = email o doctor_id unique → 409
    throw err;
  }
  return data;
}

export async function updatePortalAccountPassword(accountId, password_hash) {
  const { data, error } = await supabase
    .from('doctor_accounts')
    .update({ password_hash })
    .eq('id', accountId)
    .select('id, doctor_id, email')
    .single();
  return must({ data, error }, 'updatePortalAccountPassword');
}

/**
 * I-revoke ang portal access: burahin ang doctor_accounts row, tapos linisin
 * ang refresh_tokens sessions ng account (account_kind='doctor').
 */
export async function deletePortalAccountAndSessions(accountId) {
  const { error: delErr } = await supabase
    .from('doctor_accounts')
    .delete()
    .eq('id', accountId);
  if (delErr) {
    console.error('[adminDoctor.repository] deletePortalAccount:', delErr.message);
    throw new Error('Database error (deletePortalAccount)');
  }
  const { error: sessErr } = await supabase
    .from('refresh_tokens')
    .delete()
    .eq('account_kind', 'doctor')
    .eq('account_id', accountId);
  if (sessErr) {
    console.error('[adminDoctor.repository] deletePortalSessions:', sessErr.message);
    throw new Error('Database error (deletePortalSessions)');
  }
  return true;
}

export default {
  listDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  listAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getPortalAccountByDoctorId,
  createPortalAccount,
  updatePortalAccountPassword,
  deletePortalAccountAndSessions,
};
