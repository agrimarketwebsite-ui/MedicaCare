// backend/modules/stories/story.validation.js
// Phase 3 — query validation para sa public testimonials.

import { z } from 'zod';

export const listStoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export default { listStoriesQuerySchema };
