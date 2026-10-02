// backend/modules/patients/patient.routes.js
// Phase 4 — patient-scoped profile + family endpoints.
// requireAuth + requireRole('patient') sa lahat; ang BOLA scoping
// (patient_id = JWT.sub) ay nasa service layer, hindi sa URL.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import * as controller from './patient.controller.js';
import {
  createFamilyMemberSchema,
  familyMemberIdParamSchema,
  updateFamilyMemberSchema,
  updateProfileSchema,
} from './patient.validation.js';

const router = Router();

router.use(requireAuth, requireRole('patient'));

router.get('/me', controller.getMe);
router.put('/me', validate({ body: updateProfileSchema }), controller.updateMe);

router.get('/me/family', controller.listFamily);
router.post('/me/family', validate({ body: createFamilyMemberSchema }), controller.createFamily);
router.put(
  '/me/family/:id',
  validate({ params: familyMemberIdParamSchema, body: updateFamilyMemberSchema }),
  controller.updateFamily,
);
router.delete('/me/family/:id', validate({ params: familyMemberIdParamSchema }), controller.deleteFamily);

export default router;
