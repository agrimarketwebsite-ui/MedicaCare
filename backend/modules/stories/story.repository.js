// backend/modules/stories/story.repository.js
// Phase 3 — approved testimonials lang (status='approved').
// HINDI kasama: patient_id, reviewed_by (PII/audit — hindi public).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[story.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

export async function listApprovedStories(limit) {
  const { data, error } = await supabase
    .from('patient_stories')
    .select('id, display_name, quote, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  return must({ data, error }, 'listApprovedStories');
}

export default { listApprovedStories };
