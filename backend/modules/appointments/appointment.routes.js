// backend/modules/appointments/appointment.routes.js
// Phase 4 — patient-scoped appointment endpoints.
// requireAuth + requireRole('patient') sa lahat; ang BOLA scoping
// (patient_id = JWT.sub) ay nasa service layer.
// MAHALAGA ang order: ang /slots ay BAGO ang /:id — kung hindi,
// masi-swallow ang "slots" bilang :id param.
// Ang bookingLimiter (20/15min) ay anti-spam sa booking/reschedule writes
// (tulad ng contactLimiter precedent sa Phase 3).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { bookingLimiter } from '../../middleware/rateLimiter.js';
import * as controller from './appointment.controller.js';
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  rescheduleSchema,
  slotsQuerySchema,
} from './appointment.validation.js';

const router = Router();

router.use(requireAuth, requireRole('patient'));

router.get('/slots', validate({ query: slotsQuerySchema }), controller.getSlots);
router.get('/', validate({ query: listAppointmentsQuerySchema }), controller.list);
router.post('/', bookingLimiter, validate({ body: createAppointmentSchema }), controller.create);
router.get('/:id', validate({ params: appointmentIdParamSchema }), controller.getById);
router.post(
  '/:id/reschedule',
  bookingLimiter,
  validate({ params: appointmentIdParamSchema, body: rescheduleSchema }),
  controller.reschedule,
);
router.post('/:id/cancel', validate({ params: appointmentIdParamSchema }), controller.cancel);

export default router;
