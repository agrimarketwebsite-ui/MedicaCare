// backend/modules/contact/contact.routes.js
// Phase 3 — public WRITE endpoint (spam surface): contactLimiter (5/15min)
// + zod validation. Ang encryption ay nasa service layer.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { contactLimiter } from '../../middleware/rateLimiter.js';
import { contactSchema } from './contact.validation.js';
import * as controller from './contact.controller.js';

const router = Router();

router.post('/', contactLimiter, validate({ body: contactSchema }), controller.submitContact);

export default router;
