// backend/modules/doctors/doctor.repository.js
// Phase 3 — public doctor directory (read-only).
// - Ang doctors table ay TIER 3 plaintext lahat (walang [ENC]) — ligtas i-public.
// - Ang rating average ay galing sa v_doctor_rating_averages VIEW (hindi stored
//   sa doctors table); walang FK ang view kaya hiwalay na query + merge sa JS.
// - Laging kasama ang rating_count kapag may rating (roadmap requirement).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[doctor.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const DOCTOR_COLS =
  'id, full_name, specialty_id, status, years_of_experience, consultation_fee, room, gender, photo_url, specialties(name)';

/**
 * @param {object} f - { specialtyId, status, search, searchSpecialtyIds, limit, offset }
 * Ang search ay tumatama sa full_name O sa specialty name (tulad ng frontend
 * na nagse-search sa `d.name + ' ' + d.specialty`).
 */
export async function listDoctors(f) {
  let query = supabase.from('doctors').select(DOCTOR_COLS, { count: 'exact' });
  if (f.specialtyId) query = query.eq('specialty_id', f.specialtyId);
  if (f.status) query = query.eq('status', f.status);
  if (f.search) {
    if (f.searchSpecialtyIds && f.searchSpecialtyIds.length) {
      const ids = f.searchSpecialtyIds.join(',');
      query = query.or(`full_name.ilike.%${f.search}%,specialty_id.in.(${ids})`);
    } else {
      query = query.ilike('full_name', `%${f.search}%`);
    }
  }
  const { data, error, count } = await query
    .order('full_name', { ascending: true })
    .range(f.offset, f.offset + f.limit - 1);
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

/** specialty name (ilike) → ids. Para sa search na tumatama rin sa specialty. */
export async function findSpecialtyIdsByName(name) {
  const { data, error } = await supabase.from('specialties').select('id').ilike('name', `%${name}%`);
  const rows = must({ data, error }, 'findSpecialtyIdsByName');
  return rows.map((r) => r.id);
}

export async function listSpecialties() {
  const { data, error } = await supabase.from('specialties').select('id, name').order('name');
  return must({ data, error }, 'listSpecialties');
}

export async function findSpecialtyByName(name) {
  const { data, error } = await supabase
    .from('specialties')
    .select('id, name')
    .ilike('name', name)
    .maybeSingle();
  return must({ data, error }, 'findSpecialtyByName');
}

/** Ratings mula sa view — i-merge sa doctor rows sa service layer. */
export async function getRatingsFor(doctorIds) {
  if (!doctorIds.length) return new Map();
  const { data, error } = await supabase
    .from('v_doctor_rating_averages')
    .select('doctor_id, avg_rating, rating_count')
    .in('doctor_id', doctorIds);
  must({ data, error }, 'getRatingsFor');
  const map = new Map();
  for (const r of data) {
    map.set(r.doctor_id, { avg_rating: Number(r.avg_rating), rating_count: Number(r.rating_count) });
  }
  return map;
}

// ------------------------------------------------------------
// Phase 5 — doctor portal (own profile + weekly availability).
// ------------------------------------------------------------

/**
 * JWT.sub (doctor_accounts.id) → doctors.id. Null kapag walang account
 * (hal. ni-revoke ng admin — ang session ay stale).
 */
export async function getDoctorIdByAccountId(accountId) {
  const { data, error } = await supabase
    .from('doctor_accounts')
    .select('doctor_id')
    .eq('id', accountId)
    .maybeSingle();
  const row = must({ data, error }, 'getDoctorIdByAccountId');
  return row?.doctor_id ?? null;
}

/** Own doctor row (+ specialty name) para sa portal profile view. */
export async function getOwnDoctor(doctorId) {
  const { data, error } = await supabase
    .from('doctors')
    .select(DOCTOR_COLS)
    .eq('id', doctorId)
    .maybeSingle();
  const row = must({ data, error }, 'getOwnDoctor');
  if (!row) return null;
  const account = await supabase
    .from('doctor_accounts')
    .select('email')
    .eq('doctor_id', doctorId)
    .maybeSingle();
  const email = must(account, 'getOwnDoctorEmail')?.email ?? null;
  return { ...row, email };
}

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
    console.error('[doctor.repository] createAvailability:', error.message);
    const err = new Error('Database error (createAvailability)');
    err.code = error.code; // 23505 = unique(doctor_id, weekday, start_time) → 409
    throw err;
  }
  return data;
}

/** Scoped sa sariling doctor_id — null kapag hindi kanya (→ 404). */
export async function updateAvailability(doctorId, id, patch) {
  const { data, error } = await supabase
    .from('doctor_weekly_availability')
    .update(patch)
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .select(AVAIL_COLS)
    .maybeSingle();
  if (error) {
    console.error('[doctor.repository] updateAvailability:', error.message);
    const err = new Error('Database error (updateAvailability)');
    err.code = error.code;
    throw err;
  }
  return data;
}

/** Scoped sa sariling doctor_id — false kapag hindi kanya (→ 404). */
export async function deleteAvailability(doctorId, id) {
  const { data, error } = await supabase
    .from('doctor_weekly_availability')
    .delete()
    .eq('id', id)
    .eq('doctor_id', doctorId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[doctor.repository] deleteAvailability:', error.message);
    throw new Error('Database error (deleteAvailability)');
  }
  return Boolean(data);
}

export default {
  listDoctors,
  getDoctorById,
  findSpecialtyIdsByName,
  findSpecialtyByName,
  listSpecialties,
  getRatingsFor,
  getDoctorIdByAccountId,
  getOwnDoctor,
  listAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
};
