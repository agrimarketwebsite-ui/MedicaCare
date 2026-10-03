// backend/modules/adminStories/adminStory.routes.js
// Phase 6 — Admin Console: story moderation routes.
// Ang requireAuth + requireRole('admin') ay nasa composer
// (modules/admin/admin.routes.js).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as controller from './adminStory.controller.js';
import { listStoriesQuerySchema, storyIdParamSchema } from './adminStory.validation.js';

const router = Router();

router.get('/', validate({ query: listStoriesQuerySchema }), controller.listStories);
router.patch('/:id/approve', validate({ params: storyIdParamSchema }), controller.approveStory);
router.patch('/:id/reject', validate({ params: storyIdParamSchema }), controller.rejectStory);
router.patch('/:id/unpublish', validate({ params: storyIdParamSchema }), controller.unpublishStory);

export default router;
