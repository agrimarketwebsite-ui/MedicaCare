// backend/modules/stories/story.service.js
// Phase 3 — passthrough; ang filtering (approved-only, field selection) ay
// nasa repository (walang PII na lumalabas).

import * as repo from './story.repository.js';

export async function listApprovedStories(limit) {
  const stories = await repo.listApprovedStories(limit);
  return { stories };
}

export default { listApprovedStories };
