// backend/modules/adminNotifications/adminNotification.repository.js
// Phase 6 — Admin Console: notifications persistence (admin scope —
// requireRole('admin')). Ang mga notification ay naka-scope sa patient; ang
// read/unread ay patient-side (Phase 9).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminNotification.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const NOTIF_COLS = 'id, patient_id, appointment_id, type, title, message, read_at, created_at';

export async function listNotifications({ patientId } = {}) {
  let query = supabase.from('notifications').select(NOTIF_COLS);
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query.order('created_at', { ascending: false });
  return must({ data, error }, 'listNotifications');
}

export async function createNotification(row) {
  const { data, error } = await supabase
    .from('notifications')
    .insert(row)
    .select(NOTIF_COLS)
    .single();
  return must({ data, error }, 'createNotification');
}

export default {
  listNotifications,
  createNotification,
};
