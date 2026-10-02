// backend/modules/auth/auth.service.js
// Phase 2 — auth business logic: register/login/refresh/logout/forgot/reset.
// Role ay DERIVED sa kung aling account source ang tumugma
// (patients → 'patient', admins → 'admin', doctor_accounts → 'doctor').
// Security (ASVS V2.4/V2.5/V3.3/V6.2 — tingnan din ang BACKEND_SECURITY_AUDIT):
//   - bcrypt cost 12; GENERIC na 'Invalid email or password' — walang account
//     enumeration (parehong message + parehong timing: may dummy bcrypt compare
//     kapag walang account na tumugma).
//   - Access token 15m (JWT, iss/aud/exp verified); refresh token ay OPAQUE
//     (CSPRNG) na hash-only sa DB; ROTATION sa bawat refresh (luma → revoked);
//     REUSE DETECTION: kapag nagamit ang revoked token → i-revoke LAHAT ng
//     sessions ng account (senyales ng token theft).
//   - Passwords at token VALUES: hindi kailanman nilo-log, hindi kailanman
//     ibinabalik sa response (kahit hash) — V16.2.
//   - Password change (reset) → lahat ng sessions ay nire-revoke.

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { hashToken } from '../../shared/utils/crypto.js';
import { hashPassword, verifyPassword } from '../../shared/utils/passwords.js';
import { issueAccessToken, parseExpiresIn } from '../../shared/utils/tokens.js';
import { config } from '../../config/env.js';
import ApiError from '../../shared/utils/ApiError.js';
import * as repo from './auth.repository.js';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';
const GENERIC_FORGOT_MESSAGE = 'If an account exists for this email, a password reset link has been sent.';
const RESET_TTL_MS = 60 * 60 * 1000; // 1 oras

// Dummy hash para sa timing parity: kapag walang account na tumugma, may
// bcrypt compare pa rin para hindi mahulaan ng attacker mula sa timing kung
// may account ang email (ASVS V2.5).
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash('dummy-timing-parity', 10);
  return dummyHashPromise;
}

function toProfile(kind, account) {
  if (kind === 'patient') {
    const { id, full_name, email, phone, photo_url, created_at } = account;
    return { id, full_name, email, phone, photo_url, created_at };
  }
  if (kind === 'admin') {
    const { id, full_name, email, role, photo_url, created_at } = account;
    return { id, full_name, email, role, photo_url, created_at };
  }
  // doctor
  const { id, doctor_id, email, created_at } = account;
  return { id, doctor_id, email, created_at };
}

function newOpaqueToken() {
  return randomBytes(32).toString('hex'); // 64 hex chars, CSPRNG
}

async function issueSession(kind, accountId) {
  const accessToken = issueAccessToken({ sub: accountId, role: kind, kind });
  const refreshToken = newOpaqueToken();
  const expiresAt = new Date(Date.now() + parseExpiresIn(config.jwt.refreshExpiresIn)).toISOString();
  await repo.insertRefreshToken({
    account_kind: kind,
    account_id: accountId,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  });
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Register — patient self-registration LANG (ASVS V4.1: hindi pwedeng i-set
// ang role mula sa body; ang staff/doctor accounts ay admin-issued).
// ---------------------------------------------------------------------------
export async function register({ full_name, email, phone, password }) {
  if (await repo.emailExistsAnySource(email)) {
    throw ApiError.conflict('An account with this email already exists. Try logging in instead.');
  }
  const password_hash = await hashPassword(password);
  const account = await repo.createPatient({ full_name, email, phone, password_hash });
  await repo.logAuthEvent(email, 'auth.register', `patient:${account.id}`);
  return { profile: toProfile('patient', account) };
}

// ---------------------------------------------------------------------------
// Login — optional `role` hint para sa staff/doctor pages; kapag wala,
// susubukan ang patients → admins → doctor_accounts.
// ---------------------------------------------------------------------------
export async function login({ email, password, role }) {
  const kinds = role ? [role] : repo.ACCOUNT_KINDS;
  let matched = null;
  for (const kind of kinds) {
    const account = await repo.findAccountByEmail(kind, email);
    if (account) {
      matched = { kind, account };
      break;
    }
  }

  if (!matched) {
    // Walang account — dummy compare para sa timing parity, tapos generic error.
    await verifyPassword(password, await getDummyHash());
    await repo.logAuthEvent(email, 'auth.login.failed', 'unknown-email');
    throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
  }

  const { kind, account } = matched;
  const okPassword = await verifyPassword(password, account.password_hash);
  if (!okPassword) {
    await repo.logAuthEvent(email, 'auth.login.failed', `${kind}:${account.id}`);
    throw ApiError.unauthorized(GENERIC_LOGIN_ERROR);
  }

  const { accessToken, refreshToken } = await issueSession(kind, account.id);
  const profile = await repo.findProfileById(kind, account.id);
  await repo.logAuthEvent(email, 'auth.login.success', `${kind}:${account.id}`);
  return { accessToken, refreshToken, profile: toProfile(kind, profile), role: kind };
}

// ---------------------------------------------------------------------------
// Refresh — rotation + reuse detection.
// ---------------------------------------------------------------------------
export async function refresh(presentedToken) {
  if (!presentedToken) throw ApiError.unauthorized('Refresh token is required');
  const tokenHash = hashToken(presentedToken);
  const row = await repo.findRefreshTokenByHash(tokenHash);

  if (!row) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  if (row.revoked_at) {
    // REUSE DETECTION: ang token na ito ay ni-rotate na dati pero may gumamit
    // ulit — posibleng ninakaw. I-revoke LAHAT ng sessions ng account.
    const revokedCount = await repo.revokeAllRefreshTokens(row.account_kind, row.account_id);
    await repo.logAuthEvent(
      `${row.account_kind}:${row.account_id}`,
      'auth.refresh.reuse_detected',
      `revoked ${revokedCount} sessions`,
    );
    throw ApiError.unauthorized('Session revoked — please log in again');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw ApiError.unauthorized('Refresh token expired — please log in again');
  }

  // Ang account ay dapat existing pa (hal. ang doctor_accounts row ay
  // pwedeng tanggalin ng admin — Phase 6 ang grant/revoke UI): kapag wala
  // na, ang session ay stale → 401, hindi 500 (ang toProfile ay mag-throw
  // sa null). Naka-check BAGO mag-issue para walang orphan refresh row.
  const profile = await repo.findProfileById(row.account_kind, row.account_id);
  if (!profile) {
    throw ApiError.unauthorized('Session revoked — please log in again');
  }

  // Rotation: i-revoke ang luma, mag-issue ng bago (same account).
  await repo.revokeRefreshToken(row.id);
  const { accessToken, refreshToken } = await issueSession(row.account_kind, row.account_id);
  return { accessToken, refreshToken, profile: toProfile(row.account_kind, profile), role: row.account_kind };
}

// ---------------------------------------------------------------------------
// Logout — i-revoke LAHAT ng refresh sessions ng account (logout everywhere).
// Tandaan: ang refresh cookie ay Path=/api/auth/refresh lang (Phase 1 token
// storage decision), kaya hindi ito nakikita ng /logout — ang access token
// identity ang ginagamit. Mas ligtas din ito: isang logout, lahat ng device
// ay naka-logout.
// ---------------------------------------------------------------------------
export async function logout({ id, kind }) {
  const count = await repo.revokeAllRefreshTokens(kind, id);
  await repo.logAuthEvent(`${kind}:${id}`, 'auth.logout', `revoked ${count} sessions`);
  return { revoked: count };
}

// ---------------------------------------------------------------------------
// Forgot password — token generation ngayon; ang EMAIL SEND ay Phase 8 (Brevo).
// Laging generic ang response (walang enumeration — ASVS V2.5).
// ---------------------------------------------------------------------------
export async function forgotPassword(email) {
  const matched = await repo.findAccountAnySource(email);
  if (matched) {
    const token = newOpaqueToken();
    await repo.insertPasswordReset({
      account_kind: matched.kind,
      account_id: matched.account.id,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    });
    await repo.logAuthEvent(email, 'auth.forgot_password', `${matched.kind}:${matched.account.id}`);
    // DEV-ONLY: walang email service pa (Phase 8), kaya sa non-production ay
    // nilo-log ang token para ma-test ang reset flow. HINDI ito ginagawa sa prod.
    if (!config.isProd) {
      console.log(`[auth] DEV-ONLY password reset token for ${email}: ${token}`);
    }
  } else {
    await repo.logAuthEvent(email, 'auth.forgot_password', 'unknown-email');
  }
  return { message: GENERIC_FORGOT_MESSAGE };
}

// ---------------------------------------------------------------------------
// Reset password — single-use token, 1h TTL. Pagkatapos magpalit ng password,
// lahat ng sessions ay nire-revoke (muling mag-login sa lahat ng device).
// ---------------------------------------------------------------------------
export async function resetPassword(token, newPassword) {
  const row = await repo.findPasswordResetByHash(hashToken(token));
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }
  const password_hash = await hashPassword(newPassword);
  await repo.updatePasswordHash(row.account_kind, row.account_id, password_hash);
  await repo.markPasswordResetUsed(row.id);
  const revoked = await repo.revokeAllRefreshTokens(row.account_kind, row.account_id);
  await repo.logAuthEvent(
    `${row.account_kind}:${row.account_id}`,
    'auth.password_reset',
    `revoked ${revoked} sessions`,
  );
  return { message: 'Password has been reset. Please log in with your new password.' };
}

export default { register, login, refresh, logout, forgotPassword, resetPassword };
