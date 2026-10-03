// backend/modules/adminContact/adminContact.routes.js
// Phase 6 — Admin Console: contact message management routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminContact.controller.js';
import { messageIdParamSchema } from './adminContact.validation.js';

const router = Router();

router.get('/', controller.listContactMessages);
router.patch('/:id/handled', validate({ params: messageIdParamSchema }), controller.markHandled);

export default router;
