// backend/tests/auth.unit.test.js
// Phase 2 — unit tests (walang DB): validation schemas, passwords, JWT,
// requireRole. Tumakbo nang walang .env/Supabase.
// Ang tokens.js ay nag-i-import ng config/env.js (fail-fast), kaya nagse-set
// muna ng valid-format dummy env BAGO ang dynamic import.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://dummy.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40);
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.BREVO_API_KEY = 'xkeysib-dummy';
process.env.EMAIL_FROM_NAME = 'Test';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

let validation, passwords, tokens, middleware;
before(async () => {
  validation = await import('../modules/auth/auth.validation.js');
  passwords = await import('../shared/utils/passwords.js');
  tokens = await import('../shared/utils/tokens.js');
  middleware = await import('../modules/auth/auth.middleware.js');
});

const goodRegister = {
  full_name: 'Juan Miguel Bautista',
  email: 'Test@Example.COM', // dapat i-normalize sa lowercase
  phone: '+63 917 000 0000',
  password: 'Str0ngPass!',
};

describe('auth.validation — registerSchema', () => {
  it('tumatanggap ng valid input at nino-normalize ang email', () => {
    const out = validation.registerSchema.parse(goodRegister);
    assert.equal(out.email, 'test@example.com');
    assert.equal(out.full_name, 'Juan Miguel Bautista');
  });
  it('nirereject ang mahinang password (<8, walang numero, common)', () => {
    assert.throws(() => validation.registerSchema.parse({ ...goodRegister, password: 'short1' }), /at least 8/);
    assert.throws(() => validation.registerSchema.parse({ ...goodRegister, password: 'nonumbershere' }), /number/);
    assert.throws(() => validation.registerSchema.parse({ ...goodRegister, password: 'Patient123' }), /too common/);
  });
  it('.strict(): nirereject ang role/password_hash injection (V4.1)', () => {
    assert.throws(
      () => validation.registerSchema.parse({ ...goodRegister, role: 'admin' }),
      /Unrecognized key/,
    );
    assert.throws(
      () => validation.registerSchema.parse({ ...goodRegister, password_hash: 'x' }),
      /Unrecognized key/,
    );
  });
  it('nirereject ang bad email/phone', () => {
    assert.throws(() => validation.registerSchema.parse({ ...goodRegister, email: 'not-an-email' }));
    assert.throws(() => validation.registerSchema.parse({ ...goodRegister, phone: 'abc' }));
  });
});

describe('auth.validation — loginSchema', () => {
  it('tumatanggap ng email+password, optional role enum', () => {
    const out = validation.loginSchema.parse({ email: 'a@b.co', password: 'x' });
    assert.equal(out.role, undefined);
    assert.equal(validation.loginSchema.parse({ email: 'a@b.co', password: 'x', role: 'admin' }).role, 'admin');
  });
  it('nirereject ang invalid role', () => {
    assert.throws(() => validation.loginSchema.parse({ email: 'a@b.co', password: 'x', role: 'superuser' }));
  });
});

describe('passwords (bcrypt cost 12)', () => {
  it('roundtrip: hash → verify true; maling password → false', async () => {
    const hash = await passwords.hashPassword('Str0ngPass!');
    assert.match(hash, /^\$2[aby]\$12\$/); // cost 12
    assert.equal(await passwords.verifyPassword('Str0ngPass!', hash), true);
    assert.equal(await passwords.verifyPassword('WrongPass1', hash), false);
  });
  it('walang hash o sirang hash → false (hindi crash)', async () => {
    assert.equal(await passwords.verifyPassword('x', ''), false);
    assert.equal(await passwords.verifyPassword('x', 'not-a-hash'), false);
  });
});

describe('tokens (JWT access)', () => {
  it('roundtrip: issue → verify (sub/role/kind/iss/aud/exp)', () => {
    const t = tokens.issueAccessToken({ sub: 'uuid-123', role: 'patient', kind: 'patient' });
    const p = tokens.verifyAccessToken(t);
    assert.equal(p.sub, 'uuid-123');
    assert.equal(p.role, 'patient');
    assert.equal(p.iss, 'medicacare');
    assert.equal(p.aud, 'medicacare-app');
    assert.ok(p.exp > p.iat);
  });
  it('nirereject ang expired token', async () => {
    const jwt = await import('jsonwebtoken');
    const t = tokens.issueAccessToken({ sub: 'x', role: 'patient', kind: 'patient' });
    // I-verify na parang 1 oras na ang lumipas pagkatapos ng exp
    const payload = tokens.verifyAccessToken(t);
    assert.throws(() => {
      jwt.default.verify(t, 'a'.repeat(32), {
        issuer: 'medicacare',
        audience: 'medicacare-app',
        clockTimestamp: payload.exp + 3600,
      });
    });
  });
  it('nirereject ang token na may maling secret / iss / aud', async () => {
    const jwt = await import('jsonwebtoken');
    const t = tokens.issueAccessToken({ sub: 'x', role: 'patient', kind: 'patient' });
    assert.throws(() => jwt.default.verify(t, 'z'.repeat(32), { issuer: 'medicacare', audience: 'medicacare-app' }));
    assert.throws(() => tokens.verifyAccessToken('garbage.token.here'));
  });
  it('parseExpiresIn: 15m=900000, 7d=604800000', () => {
    assert.equal(tokens.parseExpiresIn('15m'), 900_000);
    assert.equal(tokens.parseExpiresIn('7d'), 604_800_000);
    assert.throws(() => tokens.parseExpiresIn('bogus'));
  });
});

describe('requireRole (BFLA)', () => {
  const run = (user, roles) => {
    let nextArg;
    const next = (err) => { nextArg = err; };
    middleware.requireRole(...roles)({ user }, {}, next);
    return nextArg;
  };
  it('patient sa admin-only route → 403', () => {
    const err = run({ id: '1', role: 'patient' }, ['admin']);
    assert.equal(err?.status, 403);
  });
  it('admin sa admin route → next() walang error', () => {
    assert.equal(run({ id: '1', role: 'admin' }, ['admin']), undefined);
  });
  it('walang user → 401', () => {
    const err = run(undefined, ['admin']);
    assert.equal(err?.status, 401);
  });
});
