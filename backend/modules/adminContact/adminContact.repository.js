// backend/modules/adminContact/adminContact.repository.js
// Phase 6 — Admin Console: contact_messages persistence (admin scope —
// requireRole('admin')). Ang name/email/message ay [ENC] (NAKA-ENCRYPT
// pagdating dito — ang service ang nagde-decrypt sa read).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminContact.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const MESSAGE_COLS = 'id, name, email, message, handled_at, created_at';

export async function listContactMessages() {
  const { data, error } = await supabase
    .from('contact_messages')
    .select(MESSAGE_COLS)
    .order('created_at', { ascending: false });
  return must({ data, error }, 'listContactMessages');
}

export async function markHandled(id) {
  const { data, error } = await supabase
    .from('contact_messages')
    .update({ handled_at: new Date().toISOString() })
    .eq('id', id)
    .select(MESSAGE_COLS)
    .maybeSingle();
  return must({ data, error }, 'markHandled');
}

export default {
  listContactMessages,
  markHandled,
};
