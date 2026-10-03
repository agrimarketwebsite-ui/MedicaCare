// backend/modules/adminActivity/adminActivity.routes.js
// Phase 6 — Admin Console: audit trail routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminActivity.controller.js';
import { listActivityQuerySchema } from './adminActivity.validation.js';

const router = Router();

router.get('/', validate({ query: listActivityQuerySchema }), controller.listActivity);

export default router;
