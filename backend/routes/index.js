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
import settingRoutes from '../modules/settings/setting.routes.js';
import doctorRoutes from '../modules/doctors/doctor.routes.js';
import storyRoutes from '../modules/stories/story.routes.js';
import contactRoutes from '../modules/contact/contact.routes.js';
import patientRoutes from '../modules/patients/patient.routes.js';
import appointmentRoutes from '../modules/appointments/appointment.routes.js';
import ratingRoutes from '../modules/ratings/rating.routes.js';

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

// Phase 3 — public content (read-only) + contact submission.
router.use('/settings', settingRoutes);
router.use('/doctors', doctorRoutes);
router.use('/stories', storyRoutes);
router.use('/contact', contactRoutes);

// Phase 4 — patient portal core (lahat ay requireAuth + requireRole('patient')
// sa loob ng bawat module router; ang BOLA scoping ay nasa service layer).
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/ratings', ratingRoutes);

export default router;



