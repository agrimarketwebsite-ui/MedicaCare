// backend/modules/adminDoctors/adminDoctor.routes.js
// Phase 6 — Admin Console: doctors routes (CRUD + availability editor +
// portal access). Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminDoctor.controller.js';
import {
  listDoctorsQuerySchema,
  doctorIdParamSchema,
  createDoctorSchema,
  updateDoctorSchema,
  portalAccessSchema,
  availabilitySchema,
  availabilityUpdateSchema,
  availabilityIdParamSchema,
} from './adminDoctor.validation.js';

const router = Router();

router.get('/', validate({ query: listDoctorsQuerySchema }), controller.listDoctors);
router.post('/', validate({ body: createDoctorSchema }), controller.createDoctor);
router.get('/:id', validate({ params: doctorIdParamSchema }), controller.getDoctor);
router.put('/:id', validate({ params: doctorIdParamSchema, body: updateDoctorSchema }), controller.updateDoctor);
router.delete('/:id', validate({ params: doctorIdParamSchema }), controller.deleteDoctor);

// Weekly availability editor (weekday 1-7 ISO).
router.get('/:id/availability', validate({ params: doctorIdParamSchema }), controller.listAvailability);
router.post(
  '/:id/availability',
  validate({ params: doctorIdParamSchema, body: availabilitySchema }),
  controller.addAvailability,
);
const availParamsSchema = doctorIdParamSchema.extend(availabilityIdParamSchema.shape);
router.put(
  '/:id/availability/:availId',
  validate({ params: availParamsSchema, body: availabilityUpdateSchema }),
  controller.editAvailability,
);
router.delete(
  '/:id/availability/:availId',
  validate({ params: availParamsSchema }),
  controller.removeAvailability,
);

// Portal access (doctor_accounts).
router.post(
  '/:id/portal-access',
  validate({ params: doctorIdParamSchema, body: portalAccessSchema }),
  controller.grantPortalAccess,
);
router.post(
  '/:id/portal-access/reset',
  validate({ params: doctorIdParamSchema }),
  controller.resetPortalAccess,
);
router.delete(
  '/:id/portal-access',
  validate({ params: doctorIdParamSchema }),
  controller.revokePortalAccess,
);

export default router;
