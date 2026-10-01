// backend/modules/contact/contact.repository.js
// Phase 3 — contact message insert. Ang name/email/message ay NAKA-ENCRYPT
// na pagdating dito (ang service ang nag-encrypt via crypto.js).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[contact.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

export async function createContactMessage({ name_enc, email_enc, message_enc }) {
  const { data, error } = await supabase
    .from('contact_messages')
    .insert({ name: name_enc, email: email_enc, message: message_enc })
    .select('id, created_at')
    .single();
  return must({ data, error }, 'createContactMessage');
}

export default { createContactMessage };
