// backend/modules/adminNotifications/adminNotification.routes.js
// Phase 6 — Admin Console: notification management routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminNotification.controller.js';
import {
  listNotificationsQuerySchema,
  createNotificationSchema,
} from './adminNotification.validation.js';

const router = Router();

router.get('/', validate({ query: listNotificationsQuerySchema }), controller.listNotifications);
router.post('/', validate({ body: createNotificationSchema }), controller.createNotification);

export default router;
