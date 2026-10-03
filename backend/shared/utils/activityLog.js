// backend/shared/utils/activityLog.js
// Phase 6 — shared audit-trail helpers para sa Admin Console.
// Ang activity_log table ay: actor (display name/email), action (hal.
// 'appointment.create'), detail (free text — ang TARGET ay bahagi ng detail,
// walang hiwalay na target column), created_at.
//
// Ang logActivity ay best-effort: kapag nag-fail ang insert, hindi dapat
// bumagsak ang pangunahing action (ang audit ay hindi hadlang sa operasyon).

import { supabase } from '../../config/db.js';

/**
 * I-record ang isang admin action sa activity_log. Best-effort — hindi
 * nag-throw; ang failure ay sa logs lang (console.error).
 * @param {string} actor - display name o email ng gumawa
 * @param {string} action - hal. 'appointment.create', 'story.approve'
 * @param {string} detail - human-readable na detalye (kasama ang target)
 */
export async function logActivity(actor, action, detail) {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert({ actor, action, detail: detail ?? '' });
    if (error) console.error('[activityLog] insert failed:', error.message);
  } catch (err) {
    console.error('[activityLog] insert failed:', err?.message ?? err);
  }
}

/**
 * I-resolve ang actor display name para sa isang admin user id:
 * admins.email; fallback `admin:<id8>` kapag hindi makita.
 */
export async function actorEmail(userId) {
  const info = await actorInfo(userId);
  return info.email;
}

/**
 * I-resolve ang actor identity para sa isang admin user id: { email,
 * full_name }; fallbacks kapag hindi makita (walang throw — audit-friendly).
 */
export async function actorInfo(userId) {
  const fallback = `admin:${String(userId).slice(0, 8)}`;
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return { email: fallback, full_name: fallback };
    return {
      email: data.email ?? fallback,
      full_name: data.full_name ?? data.email ?? fallback,
    };
  } catch {
    return { email: fallback, full_name: fallback };
  }
}

export default { logActivity, actorEmail, actorInfo };
