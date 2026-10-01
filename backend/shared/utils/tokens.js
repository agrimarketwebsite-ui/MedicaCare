// backend/shared/utils/tokens.js
// Phase 2 — JWT access-token issue/verify. Ang refresh tokens ay OPAQUE
// (CSPRNG hex, hash-only sa refresh_tokens table — tingnan ang
// shared/utils/crypto.js `hashToken`), hindi JWT.
// Security (ASVS V6.2 / API2):
//   - HS256, secrets >= 32 bytes at MAGKAIBA ang access/refresh
//     (validated sa config/env.js).
//   - iss/aud/exp ay sine-set sa issue at VINE-VERIFY sa bawat verify —
//     hindi tinatanggap ang token na may maling issuer/audience.
//   - Ang role claim ay DERIVED sa account source (patients/admins/
//     doctor_accounts), hindi galing sa client input (auth.service).

import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

export const TOKEN_ISSUER = 'medicacare';
export const TOKEN_AUDIENCE = 'medicacare-app';

/**
 * I-parse ang '<number><ms|s|m|h|d>' duration (hal. '15m', '7d') → milliseconds.
 * Tugma sa expiresInPattern ng config/env.js.
 */
export function parseExpiresIn(value) {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(String(value).trim());
  if (!match) throw new Error(`parseExpiresIn: hindi valid na duration '${value}'`);
  const n = Number(match[1]);
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return n * unit;
}

/**
 * Gumawa ng short-lived access token.
 * @param {{ sub: string, role: 'patient'|'admin'|'doctor', kind: string }} claims
 */
export function issueAccessToken({ sub, role, kind }) {
  if (!sub || !role || !kind) throw new Error('issueAccessToken: kailangan ng sub, role, at kind');
  return jwt.sign({ role, kind }, config.jwt.accessSecret, {
    subject: String(sub),
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: config.jwt.accessExpiresIn, // '15m' — tinatanggap ng jsonwebtoken
  });
}

/**
 * I-verify ang access token (signature + exp + iss + aud).
 * @throws kapag expired, bad signature, o maling iss/aud.
 * @returns {{ sub: string, role: string, kind: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

export default { issueAccessToken, verifyAccessToken, parseExpiresIn, TOKEN_ISSUER, TOKEN_AUDIENCE };
