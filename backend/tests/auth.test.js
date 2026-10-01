// backend/tests/auth.test.js
// Phase 2 — integration: register → login → refresh (rotate) → reuse-revoke
// → logout. Kailangan ng backend/.env + Supabase; kung wala, naka-skip ang
// suite (hindi failure).
// TANDAAN: ang bawat test FILE ay sariling process (sariling rate-limiter
// memory) — ang file na ito ay nananatili sa ≤10 authLimiter hits.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

let H = null;
try {
  H = await import('./auth.helpers.js');
} catch {
  H = null;
}

describe('auth integration — register/login/refresh/logout', { skip: !H }, () => {
  let base, server;
  const email = H ? H.uniqueEmail('phase2') : '';
  const password = 'Str0ngPass1';
  let refreshCookie = null;

  before(async () => {
    ({ base, server } = await H.bootApp());
  });

  after(async () => {
    server?.close();
    if (H) await H.cleanupAccount(email).catch(() => {});
  });

  it('register → 201, profile walang password_hash', async () => {
    const r = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Phase Two Tester', email, phone: '+63 917 000 0001', password },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.success, true);
    assert.equal(r.json.data.profile.email, email);
    assert.ok(!('password_hash' in r.json.data.profile));
  });

  it('register duplicate email → 409', async () => {
    const r = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Duplicate', email, phone: '+63 917 000 0002', password },
    });
    assert.equal(r.status, 409);
  });

  it('login maling password → 401 generic (walang enumeration)', async () => {
    const r = await H.api(base, 'POST', '/auth/login', {
      body: { email, password: 'WrongPass9' },
    });
    assert.equal(r.status, 401);
    assert.equal(r.json.message, 'Invalid email or password');
  });

  it('login tama → 200 + accessToken + httpOnly refresh cookie', async () => {
    const r = await H.api(base, 'POST', '/auth/login', { body: { email, password } });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.accessToken);
    assert.equal(r.json.data.role, 'patient');
    assert.equal(r.json.data.profile.email, email);
    const line = H.fullCookieLine(r.setCookies, 'mc_refresh');
    assert.ok(line, 'may mc_refresh cookie');
    assert.ok(/httponly/i.test(line), 'httpOnly');
    assert.ok(line.includes('Path=/api/auth/refresh'), 'path scope');
    assert.ok(/samesite=lax/i.test(line), 'SameSite=Lax');
    refreshCookie = H.getCookie(r.setCookies, 'mc_refresh');
    H._firstCookie = refreshCookie; // pang-reuse-detection test sa ibaba
    // Itago ang access token para sa logout test
    H._accessToken = r.json.data.accessToken;
  });

  it('refresh → 200, ROTATED (bagong access + bagong cookie)', async () => {
    const oldCookie = refreshCookie;
    const r = await H.api(base, 'POST', '/auth/refresh', { cookie: oldCookie });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.accessToken);
    const newCookie = H.getCookie(r.setCookies, 'mc_refresh');
    assert.ok(newCookie && newCookie !== oldCookie, 'na-rotate ang refresh cookie');
    refreshCookie = newCookie;
    H._accessToken = r.json.data.accessToken;
  });

  it('REUSE ng lumang refresh token → 401 at revoked ang buong family', async () => {
    // Gamitin ulit ang ORIGINAL (pre-rotation) na cookie — dapat ma-detect.
    const r = await H.api(base, 'POST', '/auth/refresh', { cookie: H._firstCookie });
    assert.equal(r.status, 401);
    // Pati ang pinakabagong cookie ay dapat invalid na (family revoked).
    const r2 = await H.api(base, 'POST', '/auth/refresh', { cookie: refreshCookie });
    assert.equal(r2.status, 401);
  });

  it('login ulit pagkatapos ng reuse-revoke → 200 (hindi naka-lock ang account)', async () => {
    const r = await H.api(base, 'POST', '/auth/login', { body: { email, password } });
    assert.equal(r.status, 200);
    refreshCookie = H.getCookie(r.setCookies, 'mc_refresh');
    H._accessToken = r.json.data.accessToken;
  });

  it('logout (Bearer) → 200; ang refresh cookie ay invalid na', async () => {
    const r = await H.api(base, 'POST', '/auth/logout', { token: H._accessToken });
    assert.equal(r.status, 200);
    const r2 = await H.api(base, 'POST', '/auth/refresh', { cookie: refreshCookie });
    assert.equal(r2.status, 401);
  });

  it('logout nang walang token → 401', async () => {
    const r = await H.api(base, 'POST', '/auth/logout');
    assert.equal(r.status, 401);
  });
});
