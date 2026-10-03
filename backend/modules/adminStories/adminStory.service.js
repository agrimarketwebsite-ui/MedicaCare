// backend/modules/adminStories/adminStory.service.js
// Phase 6 — Admin Console: patient story moderation business logic.
// Ang bawat moderation action ay may activity_log write.

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import * as repo from './adminStory.repository.js';

export async function listStories({ status } = {}) {
  const stories = await repo.listStories({ status });
  return { stories };
}

async function moderate({ reviewerId, actor }, id, status, actionLabel) {
  const current = await repo.getStoryById(id);
  if (!current) throw ApiError.notFound('Story not found');
  const row = await repo.moderateStory(id, { status, reviewed_by: reviewerId });
  await logActivity(actor, `story.${actionLabel}`, `Story by "${current.display_name}" → ${status}`);
  return { story: row };
}

export async function approveStory(reviewerId, actor, id) {
  return moderate({ reviewerId, actor }, id, 'approved', 'approve');
}

export async function rejectStory(reviewerId, actor, id) {
  return moderate({ reviewerId, actor }, id, 'rejected', 'reject');
}

/** Unpublish: approved → pending lang (hindi pwede ang rejected → pending). */
export async function unpublishStory(reviewerId, actor, id) {
  const current = await repo.getStoryById(id);
  if (!current) throw ApiError.notFound('Story not found');
  if (current.status !== 'approved') {
    throw ApiError.conflict(`Cannot unpublish a story with status '${current.status}'.`);
  }
  return moderate({ reviewerId, actor }, id, 'pending', 'unpublish');
}

export default {
  listStories,
  approveStory,
  rejectStory,
  unpublishStory,
};
