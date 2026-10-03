// backend/modules/adminStories/adminStory.validation.js
// Phase 6 — Admin Console: patient story moderation validation.
// Lahat .strict().

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const listStoriesQuerySchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  })
  .strict();

export const storyIdParamSchema = z
  .object({
    id: z.string().regex(UUID_RE, 'Invalid story id'),
  })
  .strict();

export default {
  listStoriesQuerySchema,
  storyIdParamSchema,
};
