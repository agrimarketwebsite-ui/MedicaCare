// backend/modules/appointments/doctorAppointment.routes.js
// Phase 5 — doctor portal appointment endpoints (mounted sa
// /api/doctor/appointments).
// requireAuth + requireRole('doctor') sa lahat; ang BOLA scoping
// (doctor_id = resolveDoctorId(JWT.sub)) ay nasa service layer.
// MAHALAGA ang order: ang /today, /week, at /patients ay BAGO ang /:id.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import * as controller from './doctorAppointment.controller.js';
import {
  completeVisitSchema,
  doctorAppointmentIdParamSchema,
  doctorScheduleQuerySchema,
  doctorWeekQuerySchema,
} from './doctorAppointment.validation.js';

const router = Router();

router.use(requireAuth, requireRole('doctor'));

router.get('/today', controller.today);
router.get('/week', validate({ query: doctorWeekQuerySchema }), controller.week);
router.get('/patients', controller.listPatients);
router.get('/', validate({ query: doctorScheduleQuerySchema }), controller.list);
router.get('/:id', validate({ params: doctorAppointmentIdParamSchema }), controller.getById);
router.post(
  '/:id/complete',
  validate({ params: doctorAppointmentIdParamSchema, body: completeVisitSchema }),
  controller.complete,
);
router.post('/:id/no-show', validate({ params: doctorAppointmentIdParamSchema }), controller.noShow);

export default router;
