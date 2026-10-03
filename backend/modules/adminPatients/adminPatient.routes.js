// backend/modules/adminPatients/adminPatient.routes.js
// Phase 6 — Admin Console: patient registry routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminPatient.controller.js';
import {
  listPatientsQuerySchema,
  patientIdParamSchema,
  createPatientSchema,
  updatePatientSchema,
} from './adminPatient.validation.js';

const router = Router();

router.get('/', validate({ query: listPatientsQuerySchema }), controller.listPatients);
router.post('/', validate({ body: createPatientSchema }), controller.createPatient);
router.get('/:id', validate({ params: patientIdParamSchema }), controller.getPatient);
router.put('/:id', validate({ params: patientIdParamSchema, body: updatePatientSchema }), controller.updatePatient);
router.delete('/:id', validate({ params: patientIdParamSchema }), controller.deletePatient);

export default router;
