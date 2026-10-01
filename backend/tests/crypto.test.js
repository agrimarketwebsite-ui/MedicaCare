// backend/tests/crypto.test.js
// Phase 1 — unit tests para sa shared/utils/crypto.js.
// Tumakbo nang walang DB: `node --test tests/crypto.test.js`.
// Ang crypto.js ay nag-i-import ng config/env.js (fail-fast validation), kaya
// nagse-set muna tayo ng valid-format dummy env BAGO ang dynamic import.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';

// Valid-format dummies — sapat para lumusot sa env.js validation.
process.env.SUPABASE_URL = 'https://dummy.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40);
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4); // 64 hex chars
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.BREVO_API_KEY = 'xkeysib-dummy';
process.env.EMAIL_FROM_NAME = 'Test';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

let crypto;
before(async () => {
  crypto = await import('../shared/utils/crypto.js');
});

describe('encryptField / decryptField (AES-256-GCM)', () => {
  it('roundtrip: decrypt(encrypt(x)) === x', () => {
    const { encryptField, decryptField } = crypto;
    for (const plain of ['', 'hello', 'Consultation for anxiety', 'ñöß — unicode ✓', 'x'.repeat(5000)]) {
      assert.equal(decryptField(encryptField(plain)), plain);
    }
  });

  it('format ay v1:<iv>:<tag>:<ct> na base64', () => {
    const ct = crypto.encryptField('test');
    const parts = ct.split(':');
    assert.equal(parts.length, 4);
    assert.equal(parts[0], 'v1');
    assert.equal(Buffer.from(parts[1], 'base64').length, 12); // IV
    assert.equal(Buffer.from(parts[2], 'base64').length, 16); // auth tag
  });

  it('randomized: dalawang encrypt ng parehong input ay magkaiba (walang equality leak)', () => {
    assert.notEqual(crypto.encryptField('same'), crypto.encryptField('same'));
  });

  it('tampered ciphertext ay nag-throw (auth tag integrity)', () => {
    const ct = crypto.encryptField('sensitive');
    const parts = ct.split(':');
    const tampered = Buffer.from(parts[3], 'base64');
    tampered[0] ^= 0xff; // baguhin ang isang byte ng ciphertext
    parts[3] = tampered.toString('base64');
    assert.throws(() => crypto.decryptField(parts.join(':')), /hindi valid na ciphertext/);
  });

  it('maling version / malformed ay nag-throw nang generic (walang oracle)', () => {
    assert.throws(() => crypto.decryptField('v2:aaaa:bbbb:cccc'), /hindi valid na ciphertext/);
    assert.throws(() => crypto.decryptField('not-a-ciphertext'), /hindi valid na ciphertext/);
    assert.throws(() => crypto.decryptField('v1:short:short:short'), /hindi valid na ciphertext/);
  });

  it('maling key ay nag-throw (hindi nagbabalik ng sirang plaintext)', () => {
    // Gumawa ng ciphertext gamit ang IBANG key, tapos i-decrypt sa module key.
    const otherKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', otherKey, iv);
    const data = Buffer.concat([cipher.update('secret', 'utf8'), cipher.final()]);
    const forged = `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
    assert.throws(() => crypto.decryptField(forged), /hindi valid na ciphertext/);
  });

  it('non-string input ay nag-throw ng TypeError', () => {
    assert.throws(() => crypto.encryptField(123), TypeError);
    assert.throws(() => crypto.decryptField(null), TypeError);
  });
});

describe('hashToken / verifyTokenHash (HMAC-SHA256)', () => {
  it('deterministic at 64-char hex', () => {
    const h1 = crypto.hashToken('raw-refresh-token-abc');
    const h2 = crypto.hashToken('raw-refresh-token-abc');
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
  });

  it('magkaibang token ay magkaibang hash', () => {
    assert.notEqual(crypto.hashToken('token-a'), crypto.hashToken('token-b'));
  });

  it('verifyTokenHash: true sa tama, false sa mali (timing-safe)', () => {
    const hash = crypto.hashToken('my-token');
    assert.equal(crypto.verifyTokenHash('my-token', hash), true);
    assert.equal(crypto.verifyTokenHash('wrong-token', hash), false);
    assert.equal(crypto.verifyTokenHash('my-token', 'not-a-hash'), false);
  });
});

describe('blindIndex (equality search)', () => {
  it('deterministic at normalized (case/space insensitive)', () => {
    const a = crypto.blindIndex(' 09171234567 ');
    assert.equal(a, crypto.blindIndex('09171234567'));
    assert.equal(crypto.blindIndex('Test@Example.com'), crypto.blindIndex('test@example.com'));
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('magkaibang values ay magkaibang index', () => {
    assert.notEqual(crypto.blindIndex('09171234567'), crypto.blindIndex('09177654321'));
  });
});

describe('isEncrypted', () => {
  it('nakikilala ang encryptField output', () => {
    assert.equal(crypto.isEncrypted(crypto.encryptField('x')), true);
    assert.equal(crypto.isEncrypted('plain'), false);
    assert.equal(crypto.isEncrypted(null), false);
  });
});
