// backend/modules/adminContact/adminContact.service.js
// Phase 6 — Admin Console: contact message management business logic.
// Ang name/email/message ay [ENC] sa DB — tolerant decrypt sa read
// (mirror ng records module). Ang mark-handled ay may activity_log write.

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import { decryptField, isEncrypted } from '../../shared/utils/crypto.js';
import * as repo from './adminContact.repository.js';

function decryptValue(value) {
  if (value === undefined || value === null) return value;
  if (!isEncrypted(value)) return value; // legacy plaintext — as-is
  try {
    return decryptField(value);
  } catch {
    return value; // ibang key / corrupt — huwag ibagsak ang read
  }
}

function toMessageDTO(row) {
  return {
    ...row,
    name: decryptValue(row.name),
    email: decryptValue(row.email),
    message: decryptValue(row.message),
  };
}

export async function listContactMessages() {
  const rows = await repo.listContactMessages();
  return { messages: rows.map(toMessageDTO) };
}

export async function markHandled(actor, id) {
  const row = await repo.markHandled(id);
  if (!row) throw ApiError.notFound('Contact message not found');
  await logActivity(actor, 'contact.handled', `Marked contact message ${id} as handled`);
  return { message: toMessageDTO(row) };
}

export default {
  listContactMessages,
  markHandled,
};
