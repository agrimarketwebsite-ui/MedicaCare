// backend/tests/auth.ratelimit.test.js
// Phase 2 — integration: brute-force protection. 11 sunod-sunod na maling
// login → ang ika-11 ay 429 (authLimiter: 10 per 15min).
// Sariling FILE = sariling process = sariling rate-limiter state, kaya
// deterministic ito anuman ang ibang test files.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

let H = null;
try {
  H = await import('./auth.helpers.js');
} catch {
  H = null;
}

describe('auth integration — rate limit (429)', { skip: !H }, () => {
  let base, server;
  const email = H ? H.uniqueEmail('phase2rl') : '';

  before(async () => {
    ({ base, server } = await H.bootApp());
    const r = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Rate Limit Tester', email, phone: '+63 917 000 0077', password: 'Str0ngPass1' },
    });
    assert.equal(r.status, 201);
  });

  after(async () => {
    server?.close();
    if (H) await H.cleanupAccount(email).catch(() => {});
  });

  it('maling password ×11 → ang huli ay 429 (V16.3: naka-log sa server)', async () => {
    let last = null;
    for (let i = 0; i < 11; i++) {
      last = await H.api(base, 'POST', '/auth/login', { body: { email, password: 'WrongPass9' } });
      if (i === 0) assert.equal(last.status, 401, 'unang attempt ay 401, hindi agad 429');
    }
    assert.equal(last.status, 429, 'ang ika-11 na attempt ay 429');
  });
});
