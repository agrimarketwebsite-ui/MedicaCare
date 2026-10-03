// backend/tests/adminContact.test.js
// Phase 6 — integration: admin contact message handling
// (PATCH /:id/handled → 200 + handled_at naka-set).
// Ang row ay direktang ini-insert via supabase gamit ang totoong [ENC]
// encryption (encryptField) para well-formed ito. Naka-skip kapag walang
// backend/.env o Supabase. 1 authLimiter hit (admin login lang).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../shared/utils/passwords.js';

let H = null;
let encryptField = null;
try {
  H = await import('./auth.helpers.js');
  // Dynamic import: ang crypto.js ay naglo-load ng config/env.js — dapat
  // nasa loob ng try para mag-skip (hindi mag-fail) kapag walang .env.
  ({ encryptField } = await import('../shared/utils/crypto.js'));
  const probe = await H.supabase.from('specialties').select('id', { count: 'exact', head: true });
  if (probe.error) throw probe.error;
} catch {
  H = null;
  encryptField = null;
}

describe('admin integration — Phase 6 contact handling', { skip: !H }, () => {
  let base, server;
  const state = {};
  const adminEmail = H?.uniqueEmail('phase6admin');
  const ADMIN_PASSWORD = 'AdminStr0ng1';

  const apiAdmin = (method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state.adminToken });

  before(async () => {
    ({ base, server } = await H.bootApp());
    const password_hash = await hashPassword(ADMIN_PASSWORD);
    const ins = await H.supabase
      .from('admins')
      .insert({ full_name: 'Phase Six Admin', email: adminEmail, password_hash })
      .select('id')
      .single();
    if (ins.error) throw new Error(`create admin: ${ins.error.message}`);
    state.adminId = ins.data.id;
    const login = await H.api(base, 'POST', '/auth/login', {
      body: { email: adminEmail, password: ADMIN_PASSWORD, role: 'admin' },
    });
    assert.equal(login.status, 200, `admin login: ${JSON.stringify(login.json)}`);
    state.adminToken = login.json.data.accessToken;
    // contact_messages row — naka-encrypt tulad ng ginagawa ng public POST.
    const c = await H.supabase
      .from('contact_messages')
      .insert({
        name: encryptField('Contact Test User'),
        email: encryptField(H.uniqueEmail('phase6contact')),
        message: encryptField('Hello, what are your clinic hours?'),
      })
      .select('id')
      .single();
    if (c.error) throw new Error(`insert contact message: ${c.error.message}`);
    state.messageId = c.data.id;
  });

  after(async () => {
    try {
      if (H && state.messageId) {
        await H.supabase.from('contact_messages').delete().eq('id', state.messageId);
      }
    } catch { /* best-effort */ }
    try {
      if (H && adminEmail) await H.cleanupAccount(adminEmail);
    } catch { /* best-effort */ }
    try {
      if (server) server.close();
    } catch { /* ignore */ }
  });

  it('PATCH /admin/contact/:id/handled → 200 + handled_at naka-set', async () => {
    const r = await apiAdmin('PATCH', `/admin/contact/${state.messageId}/handled`);
    assert.equal(r.status, 200, `handled: ${JSON.stringify(r.json)}`);
    const { data, error } = await H.supabase
      .from('contact_messages')
      .select('handled_at')
      .eq('id', state.messageId)
      .single();
    assert.ifError(error);
    assert.ok(data.handled_at, 'handled_at ay naka-set');
  });
});
