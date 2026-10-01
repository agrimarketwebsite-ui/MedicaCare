// backend/shared/utils/crypto.js
// Phase 1 — totoong implementation (dating blueprint stub).
// Role:
//   - AES-256-GCM field encryption para sa TIER 1 [ENC] columns
//     (docs/ENCRYPTION_DESIGN.md): encryptField / decryptField.
//   - HMAC-SHA256 token hashing para sa refresh_tokens.token_hash
//     (hash-only storage — ASVS V6.2): hashToken / verifyTokenHash.
//   - HMAC-SHA256 blind index para sa equality search sa encrypted fields
//     (hal. patients.phone_search): blindIndex.
// Security (ASVS V6.2/V6.3 — Cryptography):
//   - AES-256-GCM (AEAD): confidentiality + integrity; random 12-byte IV
//     PER field PER write — hindi ni-re-reuse ang IV sa parehong key.
//   - Key mula sa config.encryptionKey (32-byte hex, validated sa
//     config/env.js) — HINDI kailanman nasa source, DB, logs, o frontend.
//   - Versioned ciphertext prefix ("v1:") = path para sa key rotation
//     (bagong writes ay "v2:" kapag nag-rotate; binabasa pa rin ang "v1:").
//   - Auth tag: kapag may nag-tamper sa ciphertext sa DB, ang decrypt ay
//     nag-throw — hindi tahimik na nagbabalik ng sirang data.
//   - Blind index ay HINDI reversible (one-way HMAC) — equality search lang,
//     walang LIKE/partial match.
//   - Production: palitan ang raw env key ng envelope encryption
//     (KMS / Supabase Vault) — tingnan ang ENCRYPTION_DESIGN.md §3.

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { config } from '../../config/env.js';

const KEY = Buffer.from(config.encryptionKey, 'hex'); // 32 bytes — fail-fast validated sa env.js
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * I-encrypt ang isang plaintext field.
 * @param {string} plaintext
 * @returns {string} "v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>"
 */
export function encryptField(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptField: ang plaintext ay dapat string');
  }
  const iv = randomBytes(IV_BYTES); // CSPRNG — bawat field, bawat write
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) throw new Error('encryptField: hindi inaasahang auth tag length');
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * I-decrypt ang ciphertext na galing sa encryptField().
 * INVOKED ONLY AFTER authz/BOLA check (ENCRYPTION_DESIGN §4) — ang function
 * na ito ay walang alam sa ownership ng row.
 * @param {string} ciphertext
 * @returns {string} plaintext
 * @throws kapag malformed, maling version, o tampered (auth tag mismatch).
 */
export function decryptField(ciphertext) {
  if (typeof ciphertext !== 'string') {
    throw new TypeError('decryptField: ang ciphertext ay dapat string');
  }
  // Sadyang generic ang error messages — walang leak kung alin ang mali
  // (version vs. format vs. tag), para walang oracle sa attacker.
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('decryptField: hindi valid na ciphertext');
  }
  let iv;
  let tag;
  let data;
  try {
    iv = Buffer.from(parts[1], 'base64');
    tag = Buffer.from(parts[2], 'base64');
    data = Buffer.from(parts[3], 'base64');
  } catch {
    throw new Error('decryptField: hindi valid na ciphertext');
  }
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('decryptField: hindi valid na ciphertext');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag); // tampered ciphertext → throw dito sa final()
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Auth tag mismatch o maling key — generic lang, walang detalye.
    throw new Error('decryptField: hindi valid na ciphertext');
  }
}

/**
 * I-hash ang isang raw token (hal. refresh token) para i-store sa DB.
 * One-way HMAC-SHA256 — ang DB ay hindi kailanman humahawak ng raw token.
 * @param {string} token raw token value (CSPRNG, galing sa auth.service)
 * @returns {string} 64-char hex digest
 */
export function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('hashToken: ang token ay dapat non-empty string');
  }
  return createHmac('sha256', KEY).update(token, 'utf8').digest('hex');
}

/**
 * Timing-safe na pag-compare ng presented token laban sa stored hash.
 * @param {string} token raw token mula sa request
 * @param {string} expectedHash hash na naka-store sa DB
 * @returns {boolean}
 */
export function verifyTokenHash(token, expectedHash) {
  if (typeof token !== 'string' || typeof expectedHash !== 'string') return false;
  const actual = hashToken(token);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Blind index para sa equality search sa encrypted columns
 * (hal. patients.phone_search = blindIndex(phone)).
 * Normalization: trim + lowercase. Para sa phone, i-normalize muna ng caller
 * (digits lang) bago tumawag dito — tingnan ang ENCRYPTION_DESIGN §1 TIER 2.
 * @param {string} value
 * @returns {string} 64-char hex digest (deterministic sa parehong input)
 */
export function blindIndex(value) {
  if (typeof value !== 'string') {
    throw new TypeError('blindIndex: ang value ay dapat string');
  }
  return createHmac('sha256', KEY).update(value.trim().toLowerCase(), 'utf8').digest('hex');
}

/**
 * Mabilisang check kung ang value ay mukhang galing sa encryptField().
 * Pang-migration script / guard — hindi ito proof ng validity.
 */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}

export default { encryptField, decryptField, hashToken, verifyTokenHash, blindIndex, isEncrypted };
