// backend/modules/adminTickets/adminTicket.routes.js
// Phase 6 — Admin Console: support ticket management routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminTicket.controller.js';
import {
  listTicketsQuerySchema,
  ticketIdParamSchema,
  replySchema,
} from './adminTicket.validation.js';

const router = Router();

router.get('/', validate({ query: listTicketsQuerySchema }), controller.listTickets);
router.get('/:id', validate({ params: ticketIdParamSchema }), controller.getTicket);
router.post(
  '/:id/reply',
  validate({ params: ticketIdParamSchema, body: replySchema }),
  controller.replyToTicket,
);
router.patch('/:id/resolve', validate({ params: ticketIdParamSchema }), controller.resolveTicket);

export default router;
