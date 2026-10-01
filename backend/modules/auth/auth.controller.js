// backend/modules/auth/auth.controller.js
// Phase 2 — HTTP layer ng auth: handlers + refresh-token cookie management.
// Ang cookie ay HTTP concern (wala sa service):
//   - name: mc_refresh | httpOnly | SameSite=Lax | Secure sa prod
//   - Path=/api/auth/refresh (Phase 1 token storage decision) — ang cookie ay
//     ipinapadala LANG sa refresh endpoint, hindi sa bawat request.
// Security: passwords at token VALUES ay hindi nilo-log dito (V16.2); ang
//   responses ay hindi naglalaman ng password_hash o raw tokens maliban sa
//   accessToken na kailangan ng memory store ng frontend.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created } from '../../shared/utils/apiResponse.js';
import ApiError from '../../shared/utils/ApiError.js';
import { config } from '../../config/env.js';
import { parseExpiresIn } from '../../shared/utils/tokens.js';
import * as service from './auth.service.js';

export const REFRESH_COOKIE_NAME = 'mc_refresh';
const REFRESH_COOKIE_PATH = '/api/auth/refresh';

const cookieOptions = () => ({
  httpOnly: true, // hindi mababasa ng JS (XSS-safe)
  secure: config.isProd, // HTTPS lang sa production
  sameSite: 'lax', // gumagana sa localhost:5173 ↔ localhost:3000 (same-site, ibang port)
  path: REFRESH_COOKIE_PATH,
  maxAge: parseExpiresIn(config.jwt.refreshExpiresIn), // 7d
});

const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
};

export const register = asyncHandler(async (req, res) => {
  const { profile } = await service.register(req.validated.body);
  // 201 na walang tokens — ang login ang nag-i-issue ng session
  // (roadmap acceptance: Register → login → redirect).
  return created(res, { profile });
});

export const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, profile, role } = await service.login(req.validated.body);
  setRefreshCookie(res, refreshToken);
  return ok(res, { accessToken, profile, role });
});

export const refresh = asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!presented) {
    // Walang cookie — hindi ito reuse, sadyang walang session.
    throw ApiError.unauthorized('No refresh token — please log in again');
  }
  const { accessToken, refreshToken, profile, role } = await service.refresh(presented);
  setRefreshCookie(res, refreshToken); // rotation: bagong cookie value
  return ok(res, { accessToken, profile, role });
});

export const logout = asyncHandler(async (req, res) => {
  // requireAuth ang naglagay ng req.user.
  const { revoked } = await service.logout(req.user);
  clearRefreshCookie(res);
  return ok(res, { message: 'Logged out successfully', sessionsRevoked: revoked });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  // Laging generic ang response — kahit walang account ang email (V2.5).
  const result = await service.forgotPassword(req.validated.body.email);
  return ok(res, result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.validated.body;
  const result = await service.resetPassword(token, password);
  return ok(res, result);
});

export default { register, login, refresh, logout, forgotPassword, resetPassword };
