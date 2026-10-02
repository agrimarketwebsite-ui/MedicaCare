// backend/modules/doctors/doctor.routes.js
// Phase 3 — public, read-only. TANDAAN ang order: ang `/specialties` at ang
// Phase 5 `/me/*` routes ay naka-register BAGO ang `/:id` (kung hindi, ang
// "specialties"/"me" ay huhulihin ng :id param at magiging 400).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { listDoctorsQuerySchema, doctorIdParamSchema } from './doctor.validation.js';
import {
  availabilityIdParamSchema,
  availabilitySchema,
  availabilityUpdateSchema,
} from './doctor.validation.js';
import * as controller from './doctor.controller.js';

const router = Router();

router.get('/specialties', controller.listSpecialties);

// Phase 5 — doctor portal (requireRole('doctor'); ang BOLA scoping ay nasa
// service via resolveDoctorId: JWT.sub = doctor_accounts.id → doctors.id).
const doctorOnly = [requireAuth, requireRole('doctor')];
router.get('/me/profile', ...doctorOnly, controller.getOwnProfile);
router.get('/me/availability', ...doctorOnly, controller.listOwnAvailability);
router.post('/me/availability', ...doctorOnly, validate({ body: availabilitySchema }), controller.createAvailability);
router.put(
  '/me/availability/:availId',
  ...doctorOnly,
  validate({ params: availabilityIdParamSchema, body: availabilityUpdateSchema }),
  controller.updateAvailability,
);
router.delete(
  '/me/availability/:availId',
  ...doctorOnly,
  validate({ params: availabilityIdParamSchema }),
  controller.deleteAvailability,
);

router.get('/', validate({ query: listDoctorsQuerySchema }), controller.listDoctors);
router.get('/:id', validate({ params: doctorIdParamSchema }), controller.getDoctorById);

export default router;
