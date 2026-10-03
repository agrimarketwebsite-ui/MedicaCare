// backend/modules/adminSettings/adminSetting.routes.js
// Phase 6 — Admin Console: settings routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminSetting.controller.js';
import { clinicUpdateSchema, appUpdateSchema } from './adminSetting.validation.js';

const router = Router();

router.get('/clinic', controller.getClinic);
router.put('/clinic', validate({ body: clinicUpdateSchema }), controller.updateClinic);
router.get('/app', controller.getApp);
router.put('/app', validate({ body: appUpdateSchema }), controller.updateApp);

export default router;
