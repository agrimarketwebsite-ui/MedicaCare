// backend/middleware/rateLimiter.js
// Brute-force protection (API4 / ASVS V2.5): keyed by IP. Ang general apiLimiter
// ay naka-apply sa lahat ng /api; ang authLimiter (mas mahigpit) ay i-a-attach ng
// auth routes sa mga credential endpoints. I-log ang mga 429 para sa
// brute-force monitoring (V16.3).

import rateLimit from 'express-rate-limit';
import ApiError from '../shared/utils/ApiError.js';

const handler = (_req, _res, next, options) => {
  console.warn(`[rate-limit] 429 — ${options.statusCode} sa ${options.windowMs}ms window`);
  // FIX (Phase 2): dati ay `next(options.message)` — string ang naipapasa sa
  // errorHandler, kaya nagiging 500 imbis na 429. ApiError para sa tamang
  // 429 envelope (V16.3: naka-log pa rin sa itaas).
  next(ApiError.tooManyRequests('Too many requests, please try again later.'));
};

// General: sapat para sa normal na clinic usage, mapoprotektahan ang uptime.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

// Credential endpoints: mas mahigpit (brute-force surface).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

// Public write endpoints (spam surface): pinaka-mahigpit.
export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

// Phase 4 — booking/reschedule writes (slot-race + spam surface): mas
// mahigpit sa general limiter, mas maluwag sa contact (ang pasyente ay
// pwedeng mag-book ng ilang appointments nang sunod-sunod).
export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

export default apiLimiter;


