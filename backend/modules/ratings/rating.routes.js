// backend/modules/ratings/rating.routes.js
// Phase 4 — patient-scoped rating submission (POST /, requireRole('patient')).
// Phase 5 — doctor feedback view (GET /doctor, requireRole('doctor')).
// Per-route ang auth (hindi blanket router.use) para magkaiba ang role.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import * as controller from './rating.controller.js';
import { createRatingSchema } from './rating.validation.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('patient'),
  validate({ body: createRatingSchema }),
  controller.create,
);

router.get('/doctor', requireAuth, requireRole('doctor'), controller.doctorFeedback);

export default router;
