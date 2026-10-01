// backend/modules/auth/auth.middleware.js
// Phase 2 — requireAuth (JWT verify) + requireRole(...).
// Security (API2/API5 / ASVS V3.4/V4.1):
//   - Ang signature + exp + iss/aud ay VINE-VERIFY sa BAWAT request — hindi
//     pinagkakatiwalaan ang client-claimed role.
//   - requireRole sa bawat admin/doctor route = function-level authorization
//     (BFLA); ang object-level checks (BOLA) ay nasa service layer per module.

import { verifyAccessToken } from '../../shared/utils/tokens.js';
import ApiError from '../../shared/utils/ApiError.js';

/** I-verify ang Bearer token at i-attach ang req.user = { id, role, kind }. */
export function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Authentication required');
    }
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, kind: payload.kind };
    return next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    // Expired / bad signature / maling iss-aud — lahat ay 401, walang detalye.
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/** Tanging ang mga role na ito ang pwede (gamitin PAGKATAPOS ng requireAuth). */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required'));
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }
  return next();
};

export default { requireAuth, requireRole };
