// backend/shared/utils/passwords.js
// Phase 2 — password hashing/verification (bcrypt).
// Security (ASVS V2.4 — BACKEND_SECURITY_AUDIT):
//   - bcrypt cost 12 (>= 10 required). Ang cost ay sadyang mataas para
//     magastos ang brute-force, pero sapat na mabilis para sa login UX.
//   - One-way hash LANG — walang encryption ng passwords, at hindi kailanman
//     ibinabalik ang hash sa API response (auth.service nagfi-filter).
//   - Ang pgcrypto seed hashes ($2a$ blowfish, galing sa database/seed) ay
//     standard bcrypt format — kayang i-verify ng bcryptjs.compare.

import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;

/**
 * I-hash ang plaintext password bago i-store.
 * @param {string} plaintext
 * @returns {Promise<string>} bcrypt hash ($2b$12$...)
 */
export async function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new TypeError('hashPassword: kailangan ng non-empty string');
  }
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

/**
 * I-compare ang plaintext laban sa stored hash (timing-safe sa bcryptjs).
 * @returns {Promise<boolean>} false kapag mali, kapag walang hash, o kapag sira ang hash.
 */
export async function verifyPassword(plaintext, hash) {
  if (typeof plaintext !== 'string' || typeof hash !== 'string' || !hash) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false; // sirang hash format — tratuhin bilang mismatch, hindi crash
  }
}

export default { hashPassword, verifyPassword, BCRYPT_COST };
