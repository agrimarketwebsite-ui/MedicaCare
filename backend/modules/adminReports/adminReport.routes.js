// backend/modules/adminReports/adminReport.routes.js
// Phase 6 — Admin Console: reports routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminReport.controller.js';
import { exportCsvQuerySchema } from './adminReport.validation.js';

const router = Router();

router.get('/stats', controller.getStats);
router.get('/specialties', controller.getAppointmentsBySpecialty);
router.get('/busiest-doctors', controller.getBusiestDoctors);
router.get('/export.csv', validate({ query: exportCsvQuerySchema }), controller.exportCsv);

export default router;
