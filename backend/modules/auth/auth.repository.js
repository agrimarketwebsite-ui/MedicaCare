// backend/modules/auth/auth.repository.js
// Phase 2 — data access LANG (walang business logic dito).
// Tables: patients / admins / doctor_accounts / refresh_tokens /
//           password_resets / activity_log — via Supabase query builder.
// Security (ASVS V1.2/V6.2):
//   - Parameterized / query-builder lang — HUWAG string-built na SQL (injection).
//   - Sa refresh_tokens: HASH lang ng token ang stored/quine-query (hindi raw
//     token); ang service ang nag-a-apply ng expires_at/revoked_at checks.

import { supabase } from '../../config/db.js';

// Account sources — ang role ng JWT ay derived sa tumugmang source
// (BACKEND_ARCHITECTURE §6.1). Ang profileCols ay SAFE fields lang —
// HINDI kasama ang password_hash sa profile responses.
const SOURCES = {
  patient: { table: 'patients', profileCols: 'id, full_name, email, phone, photo_url, created_at' },
  admin: { table: 'admins', profileCols: 'id, full_name, email, role, photo_url, created_at' },
  doctor: { table: 'doctor_accounts', profileCols: 'id, doctor_id, email, created_at' },
};

export const ACCOUNT_KINDS = Object.keys(SOURCES);

function must(result, context) {
  if (result.error) {
    // Ang DB detail ay sa server logs lang — hindi ito umaabot sa client
    // (ang service ang nagko-convert sa generic ApiError).
    console.error(`[auth.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Account lookups
// ---------------------------------------------------------------------------

/** Buong row KASAMA ang password_hash (pang-login verify lang — hindi ito ibinabalik sa client). */
export async function findAccountByEmail(kind, email) {
  const { table } = SOURCES[kind];
  const { data, error } = await supabase
    .from(table)
    .select('id, email, password_hash')
    .eq('email', email)
    .maybeSingle();
  if (error) return must({ data, error }, `findAccountByEmail:${table}`);
  return data;
}

/** Hanapin sa lahat ng sources (patients → admins → doctor_accounts). */
export async function findAccountAnySource(email) {
  for (const kind of ACCOUNT_KINDS) {
    const account = await findAccountByEmail(kind, email);
    if (account) return { kind, account };
  }
  return null;
}

export async function emailExistsAnySource(email) {
  return (await findAccountAnySource(email)) !== null;
}

/** Safe profile (walang password_hash) para sa API responses. */
export async function findProfileById(kind, id) {
  const { table, profileCols } = SOURCES[kind];
  const { data, error } = await supabase.from(table).select(profileCols).eq('id', id).maybeSingle();
  if (error) return must({ data, error }, `findProfileById:${table}`);
  return data;
}

export async function createPatient({ full_name, email, phone, password_hash }) {
  const { data, error } = await supabase
    .from('patients')
    .insert({ full_name, email, phone, password_hash })
    .select('id, full_name, email, phone, photo_url, created_at')
    .single();
  return must({ data, error }, 'createPatient');
}

export async function updatePasswordHash(kind, id, password_hash) {
  const { table } = SOURCES[kind];
  const { data, error } = await supabase
    .from(table)
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  return must({ data, error }, `updatePasswordHash:${table}`);
}

// ---------------------------------------------------------------------------
// Refresh tokens (hash-only)
// ---------------------------------------------------------------------------

export async function insertRefreshToken({ account_kind, account_id, token_hash, expires_at }) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .insert({ account_kind, account_id, token_hash, expires_at })
    .select('id')
    .single();
  return must({ data, error }, 'insertRefreshToken');
}

/** Row kasama ang revoked_at/expires_at — ang SERVICE ang nagde-decide (kailangan ang revoked rows para sa reuse detection). */
export async function findRefreshTokenByHash(token_hash) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('id, account_kind, account_id, expires_at, revoked_at')
    .eq('token_hash', token_hash)
    .maybeSingle();
  if (error) return must({ data, error }, 'findRefreshTokenByHash');
  return data;
}

export async function revokeRefreshToken(id) {
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) must({ data: null, error }, 'revokeRefreshToken');
}

export async function revokeAllRefreshTokens(account_kind, account_id) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('account_kind', account_kind)
    .eq('account_id', account_id)
    .is('revoked_at', null)
    .select('id');
  if (error) must({ data: null, error }, 'revokeAllRefreshTokens');
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Password resets (hash-only, single-use, 1h TTL)
// ---------------------------------------------------------------------------

export async function insertPasswordReset({ account_kind, account_id, token_hash, expires_at }) {
  const { data, error } = await supabase
    .from('password_resets')
    .insert({ account_kind, account_id, token_hash, expires_at })
    .select('id')
    .single();
  return must({ data, error }, 'insertPasswordReset');
}

export async function findPasswordResetByHash(token_hash) {
  const { data, error } = await supabase
    .from('password_resets')
    .select('id, account_kind, account_id, expires_at, used_at')
    .eq('token_hash', token_hash)
    .maybeSingle();
  if (error) return must({ data, error }, 'findPasswordResetByHash');
  return data;
}

export async function markPasswordResetUsed(id) {
  const { error } = await supabase
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id);
  if (error) must({ data: null, error }, 'markPasswordResetUsed');
}

// ---------------------------------------------------------------------------
// Audit trail (V9) — best-effort: hindi dapat mag-fail ang auth request
// dahil lang hindi na-log ang event.
// ---------------------------------------------------------------------------

export async function logAuthEvent(actor, action, detail = '') {
  try {
    const { error } = await supabase.from('activity_log').insert({ actor, action, detail });
    if (error) console.error('[auth.repository] logAuthEvent failed:', error.message);
  } catch (err) {
    console.error('[auth.repository] logAuthEvent failed:', err.message);
  }
}

export default {
  ACCOUNT_KINDS,
  findAccountByEmail,
  findAccountAnySource,
  emailExistsAnySource,
  findProfileById,
  createPatient,
  updatePasswordHash,
  insertRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  insertPasswordReset,
  findPasswordResetByHash,
  markPasswordResetUsed,
  logAuthEvent,
};
