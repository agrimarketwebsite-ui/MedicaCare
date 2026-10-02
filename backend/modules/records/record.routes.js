// backend/modules/records/record.routes.js
// Phase 5 — doctor-written records (mounted sa /api/records).
// requireAuth + requireRole('doctor') sa lahat; ang doctor-patient relation
// check (BOLA) ay nasa service layer.
// MAHALAGA ang order: ang /medical at /lab at /medications ay BAGO ang
// /medical/:id — kung hindi, ang "lab"/"medications" ay huhulihin ng :id.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import * as controller from './record.controller.js';
import {
  createLabResultSchema,
  createMedicalRecordSchema,
  createMedicationSchema,
  patientQuerySchema,
  recordIdParamSchema,
  updateMedicalRecordSchema,
} from './record.validation.js';

const router = Router();

router.use(requireAuth, requireRole('doctor'));

router.post('/medical', validate({ body: createMedicalRecordSchema }), controller.createMedical);
router.get('/medical', validate({ query: patientQuerySchema }), controller.listMedical);
router.put(
  '/medical/:id',
  validate({ params: recordIdParamSchema, body: updateMedicalRecordSchema }),
  controller.updateMedical,
);

router.post('/lab', validate({ body: createLabResultSchema }), controller.createLab);
router.get('/lab', validate({ query: patientQuerySchema }), controller.listLab);

router.post('/medications', validate({ body: createMedicationSchema }), controller.createMedication);
router.get('/medications', validate({ query: patientQuerySchema }), controller.listMedications);

export default router;
