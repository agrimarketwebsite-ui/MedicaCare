// backend/modules/auth/auth.routes.js
// Phase 2 — POST /api/auth/register, /login, /refresh, /logout,
//                 /forgot-password, /reset-password.
// Security (API4 / ASVS V2.5):
//   - authLimiter (10/15min) sa mga credential endpoints
//     (register/login/forgot/reset) — brute-force protection.
//   - Ang /refresh ay bearer-token rotation (hindi password guessing) —
//     may sariling refreshLimiter (120/15min). Dati itong nakasama sa
//     authLimiter at nagiging sanhi ng spurious logout: bawat page reload
//     ay 1 refresh, kaya ang 10/15min budget ay nauubos sa normal na
//     paggamit/testing, at ang 429 ay nai-interpret ng client bilang
//     expired session.
//   - Ang /logout ay authenticated (requireAuth) — hindi kailangan ng limiter.
//   - Ang forgot-password ay laging generic ang tugon kahit wala ang email
//     sa DB (walang enumeration).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authLimiter, refreshLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth } from './auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/refresh', refreshLimiter, controller.refresh);
router.post('/logout', requireAuth, controller.logout);
router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), controller.resetPassword);

export default router;
