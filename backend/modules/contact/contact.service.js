// backend/modules/contact/contact.service.js
// Phase 3 — contact submission: i-encrypt ang [ENC] fields (name/email/message)
// BAGO i-save (ENCRYPTION_DESIGN). Ang acknowledgment email ay Phase 8 (Brevo).

import { encryptField } from '../../shared/utils/crypto.js';
import * as repo from './contact.repository.js';

export async function submitContact({ name, email, message }) {
  const [name_enc, email_enc, message_enc] = await Promise.all([
    encryptField(name),
    encryptField(email),
    encryptField(message),
  ]);
  const row = await repo.createContactMessage({ name_enc, email_enc, message_enc });
  return {
    message: 'Thanks! Your message has been received — our team will get back to you within 1–2 business days.',
    id: row.id,
  };
}

export default { submitContact };
