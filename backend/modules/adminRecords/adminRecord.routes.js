// backend/modules/adminRecords/adminRecord.routes.js
// Phase 6 — Admin Console: labs & medications routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminRecord.controller.js';
import {
  listLabsQuerySchema,
  createLabSchema,
  updateLabSchema,
  listMedicationsQuerySchema,
  createMedicationSchema,
  updateMedicationSchema,
  recordIdParamSchema,
} from './adminRecord.validation.js';

const router = Router();

// Lab results.
router.get('/labs', validate({ query: listLabsQuerySchema }), controller.listLabResults);
router.post('/labs', validate({ body: createLabSchema }), controller.createLabResult);
router.put('/labs/:id', validate({ params: recordIdParamSchema, body: updateLabSchema }), controller.updateLabResult);
router.delete('/labs/:id', validate({ params: recordIdParamSchema }), controller.deleteLabResult);

// Medications.
router.get('/medications', validate({ query: listMedicationsQuerySchema }), controller.listMedications);
router.post('/medications', validate({ body: createMedicationSchema }), controller.createMedication);
router.put(
  '/medications/:id',
  validate({ params: recordIdParamSchema, body: updateMedicationSchema }),
  controller.updateMedication,
);
router.delete('/medications/:id', validate({ params: recordIdParamSchema }), controller.deleteMedication);

export default router;
