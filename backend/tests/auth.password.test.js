// backend/tests/auth.password.test.js
// Phase 2 — integration: forgot-password (generic response, walang
// enumeration) → reset-password (single-use, 1h TTL) → login gamit ang bagong
// password. Kailangan ng backend/.env + Supabase; kung wala, naka-skip.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

let H = null;
try {
  H = await import('./auth.helpers.js');
} catch {
  H = null;
}

describe('auth integration — forgot/reset password', { skip: !H }, () => {
  let base, server;
  const email = H ? H.uniqueEmail('phase2pw') : '';
  const oldPassword = 'Str0ngPass1';
  const newPassword = 'N3wStr0ngPass!';

  before(async () => {
    ({ base, server } = await H.bootApp());
    // Gumawa ng account na ire-reset
    const r = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Password Reset Tester', email, phone: '+63 917 000 0009', password: oldPassword },
    });
    assert.equal(r.status, 201);
  });

  after(async () => {
    server?.close();
    if (H) await H.cleanupAccount(email).catch(() => {});
  });

  it('forgot-password sa existing email → 200 generic message', async () => {
    const r = await H.api(base, 'POST', '/auth/forgot-password', { body: { email } });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.message, 'If an account exists for this email, a password reset link has been sent.');
  });

  it('forgot-password sa unknown email → 200 PAREHONG message (walang enumeration)', async () => {
    const r = await H.api(base, 'POST', '/auth/forgot-password', {
      body: { email: `nobody.${Date.now()}@example.com` },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.message, 'If an account exists for this email, a password reset link has been sent.');
  });

  it('reset-password gamit ang valid token → 200; single-use', async () => {
    // Direktang mag-insert ng reset row (ang email send ay Phase 8 pa)
    const { hashToken } = await import('../shared/utils/crypto.js');
    const rawToken = randomBytes(32).toString('hex');
    const found = await H.repository.findAccountAnySource(email);
    await H.repository.insertPasswordReset({
      account_kind: found.kind,
      account_id: found.account.id,
      token_hash: hashToken(rawToken),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    const r = await H.api(base, 'POST', '/auth/reset-password', {
      body: { token: rawToken, password: newPassword },
    });
    assert.equal(r.status, 200);

    // Single-use: pangalawang gamit ay dapat mag-fail
    const r2 = await H.api(base, 'POST', '/auth/reset-password', {
      body: { token: rawToken, password: 'Another1Pass!' },
    });
    assert.equal(r2.status, 400);
  });

  it('reset-password gamit ang invalid token → 400', async () => {
    const r = await H.api(base, 'POST', '/auth/reset-password', {
      body: { token: 'f'.repeat(64), password: newPassword },
    });
    assert.equal(r.status, 400);
  });

  it('login gamit ang BAGONG password → 200; lumang password → 401', async () => {
    const ok = await H.api(base, 'POST', '/auth/login', { body: { email, password: newPassword } });
    assert.equal(ok.status, 200);
    const bad = await H.api(base, 'POST', '/auth/login', { body: { email, password: oldPassword } });
    assert.equal(bad.status, 401);
    assert.equal(bad.json.message, 'Invalid email or password');
  });
});
