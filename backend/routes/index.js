// backend/routes/index.js
// API router: mounts every module under its /api/* prefix. Ang mga module routers
// (auth una) ay idadagdag dito habang nai-implement; ang /api/health ay laging
// available para sa boot/uptime verification.

import { Router } from 'express';
import asyncHandler from '../shared/utils/asyncHandler.js';
import { ok } from '../shared/utils/apiResponse.js';
import { supabase } from '../config/db.js';
import { config } from '../config/env.js';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

// Liveness + DB reachability probe. Ang DB check ay best-effort: hindi hadlang
// ng /api/health ang schema na hindi pa nai-apply — status lang ang ini-report
// sa response (DB error details ay sa logs lang, walang info leak).
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    let db = 'ok';
    const { error } = await supabase.from('specialties').select('id', { count: 'exact', head: true });
    if (error) {
      db = 'unreachable';
      console.error('[health] DB ping failed:', error.message);
    }
    return ok(res, {
      status: 'ok',
      service: 'medicacare-backend',
      env: config.env,
      db,
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  }),
);

// Phase 2 — auth module (register/login/refresh/logout/forgot/reset).
router.use('/auth', authRoutes);

export default router;

