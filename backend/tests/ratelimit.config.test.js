// backend/tests/ratelimit.config.test.js
// Phase 4 follow-up: /auth/refresh ay HINDI dapat sumasama sa authLimiter
// (10/15min). Bawat page reload ay 1 refresh — ang masikip na budget ay
// nagdudulot ng spurious logout (429 sa refresh → client logout).
// Structural guard: ang refresh route ay may sariling, hiwalay na limiter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authLimiter, refreshLimiter, apiLimiter, contactLimiter, bookingLimiter } from '../middleware/rateLimiter.js';

test('refreshLimiter ay hiwalay sa authLimiter (hindi pwedeng pag-isahin)', () => {
  assert.equal(typeof refreshLimiter, 'function');
  assert.equal(typeof authLimiter, 'function');
  assert.notEqual(refreshLimiter, authLimiter, 'ang /refresh ay dapat may sariling limiter, hindi authLimiter');
});

test('lahat ng limiter ay functions (hindi nasira ang wiring)', () => {
  for (const [name, mw] of Object.entries({ apiLimiter, authLimiter, refreshLimiter, contactLimiter, bookingLimiter })) {
    assert.equal(typeof mw, 'function', `${name} ay dapat middleware function`);
  }
});
