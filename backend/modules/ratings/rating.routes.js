// backend/modules/ratings/rating.routes.js
// Phase 4 — patient-scoped rating submission.
// requireAuth + requireRole('patient'); ang appointment ownership check
// (BOLA) ay nasa service layer.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import * as controller from './rating.controller.js';
import { createRatingSchema } from './rating.validation.js';

const router = Router();

router.use(requireAuth, requireRole('patient'));

router.post('/', validate({ body: createRatingSchema }), controller.create);

export default router;
