// backend/modules/adminAppointments/adminAppointment.routes.js
// Phase 6 — Admin Console: appointment management routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminAppointment.controller.js';
import {
  listAppointmentsQuerySchema,
  appointmentIdParamSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  statusUpdateSchema,
  completeVisitSchema,
} from './adminAppointment.validation.js';

const router = Router();

router.get('/', validate({ query: listAppointmentsQuerySchema }), controller.listAppointments);
router.post('/', validate({ body: createAppointmentSchema }), controller.createAppointment);
router.get('/:id', validate({ params: appointmentIdParamSchema }), controller.getAppointment);
router.put(
  '/:id',
  validate({ params: appointmentIdParamSchema, body: updateAppointmentSchema }),
  controller.updateAppointment,
);
router.patch(
  '/:id/status',
  validate({ params: appointmentIdParamSchema, body: statusUpdateSchema }),
  controller.setAppointmentStatus,
);
router.post(
  '/:id/complete',
  validate({ params: appointmentIdParamSchema, body: completeVisitSchema }),
  controller.completeAppointment,
);
router.delete('/:id', validate({ params: appointmentIdParamSchema }), controller.deleteAppointment);

export default router;
