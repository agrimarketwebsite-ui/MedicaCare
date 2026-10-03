// backend/modules/adminActivity/adminActivity.repository.js
// Phase 6 — Admin Console: activity_log read persistence (read-only).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminActivity.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const ACTIVITY_COLS = 'id, actor, action, detail, created_at';

/** Inclusive date range: ang `to` ay sumasaklaw sa buong araw (UTC+1day lt). */
export async function listActivity({ actor, action, from, to, page, limit }) {
  let query = supabase.from('activity_log').select(ACTIVITY_COLS, { count: 'exact' });
  if (actor) query = query.ilike('actor', `%${actor}%`);
  if (action) query = query.ilike('action', `%${action}%`);
  if (from) query = query.gte('created_at', from);
  if (to) {
    const endExclusive = new Date(new Date(`${to}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();
    query = query.lt('created_at', endExclusive);
  }
  const offset = (page - 1) * limit;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  must({ data, error }, 'listActivity');
  return { rows: data, total: count ?? data.length };
}

export default {
  listActivity,
};
