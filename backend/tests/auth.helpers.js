// backend/tests/auth.helpers.js
/* global fetch */
// Shared helpers para sa auth integration tests. HINDI ito test file
// (walang .test.js suffix kaya hindi ito direktang pinapatakbo ng npm test).
// Ang pag-import nito ay naglo-load ng app.js → config/env.js (fail-fast);
// ang mga test files ay nagca-catch ng failure para i-skip ang suite kapag
// walang backend/.env o Supabase.

import { createApp } from '../app.js';
import * as repository from '../modules/auth/auth.repository.js';
import { supabase } from '../config/db.js';

export { repository, supabase };

export async function bootApp() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return { server, base };
}

export async function api(base, method, path, { body, cookie, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, json, setCookies };
}

/** Kunin ang "name=value" na bahagi ng Set-Cookie (pang-send pabalik). */
export function getCookie(setCookies, name) {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  return line ? line.split(';')[0] : null;
}

export function fullCookieLine(setCookies, name) {
  return setCookies.find((c) => c.startsWith(`${name}=`)) || '';
}

export function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`;
}

/** Burahin ang test account at ang mga session/reset rows nito. */
export async function cleanupAccount(email) {
  const found = await repository.findAccountAnySource(email);
  if (!found) return;
  const { kind, account } = found;
  await supabase.from('refresh_tokens').delete().eq('account_kind', kind).eq('account_id', account.id);
  await supabase.from('password_resets').delete().eq('account_kind', kind).eq('account_id', account.id);
  const table = kind === 'patient' ? 'patients' : kind === 'admin' ? 'admins' : 'doctor_accounts';
  await supabase.from(table).delete().eq('id', account.id);
}
