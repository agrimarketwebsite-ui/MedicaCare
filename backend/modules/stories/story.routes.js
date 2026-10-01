// backend/modules/stories/story.routes.js
// Phase 3 — public, read-only.

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { listStoriesQuerySchema } from './story.validation.js';
import * as controller from './story.controller.js';

const router = Router();

router.get('/', validate({ query: listStoriesQuerySchema }), controller.listStories);

export default router;
