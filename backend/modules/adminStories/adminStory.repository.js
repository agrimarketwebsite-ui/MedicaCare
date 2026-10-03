// backend/modules/adminStories/adminStory.repository.js
// Phase 6 — Admin Console: patient_stories moderation persistence.
// Ang public read (stories module) ay hindi kasama ang reviewed_by/reviewed_at
// — dito sa admin sila kasama (audit trail).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminStory.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const STORY_COLS = 'id, display_name, quote, status, reviewed_at, reviewed_by, created_at';

export async function listStories({ status } = {}) {
  let query = supabase.from('patient_stories').select(STORY_COLS);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  return must({ data, error }, 'listStories');
}

export async function getStoryById(id) {
  const { data, error } = await supabase
    .from('patient_stories')
    .select(STORY_COLS)
    .eq('id', id)
    .maybeSingle();
  return must({ data, error }, 'getStoryById');
}

export async function moderateStory(id, { status, reviewed_by }) {
  const { data, error } = await supabase
    .from('patient_stories')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by })
    .eq('id', id)
    .select(STORY_COLS)
    .maybeSingle();
  return must({ data, error }, 'moderateStory');
}

export default {
  listStories,
  getStoryById,
  moderateStory,
};
