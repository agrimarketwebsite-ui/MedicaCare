// backend/modules/settings/setting.routes.js
// Phase 3 — public, read-only. Ang general apiLimiter (300/15min) ay sapat;
// walang auth — ito ang binabasa ng landing at footer bago mag-login.

import { Router } from 'express';
import * as controller from './setting.controller.js';

const router = Router();

router.get('/public', controller.getPublicSettings);

export default router;
