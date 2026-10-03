// backend/modules/adminTickets/adminTicket.service.js
// Phase 6 — Admin Console: support ticket management business logic.
// Ang message body ay [ENC]: encryptField on write, tolerant decrypt on read
// (mirror ng records module). Ang bawat mutating action ay may activity_log
// write.

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import { encryptField, decryptField, isEncrypted } from '../../shared/utils/crypto.js';
import * as repo from './adminTicket.repository.js';

/** Tolerant decrypt — legacy plaintext/corrupt ay hindi nagpa-500 ng read. */
function decryptBody(value) {
  if (value === undefined || value === null) return value;
  if (!isEncrypted(value)) return value;
  try {
    return decryptField(value);
  } catch {
    return value;
  }
}

function toTicketDTO(row) {
  const rest = { ...row };
  const patients = rest.patients;
  delete rest.patients;
  return {
    ...rest,
    patient: patients ? { id: patients.id, full_name: patients.full_name, email: patients.email } : null,
  };
}

function toMessageDTO(row) {
  return { ...row, body: decryptBody(row.body) };
}

export async function listTickets({ status } = {}) {
  const rows = await repo.listTickets({ status });
  return { tickets: rows.map(toTicketDTO) };
}

export async function getTicket(id) {
  const row = await repo.getTicketById(id);
  if (!row) throw ApiError.notFound('Ticket not found');
  const messages = await repo.listTicketMessages(id);
  return { ticket: toTicketDTO(row), messages: messages.map(toMessageDTO) };
}

export async function replyToTicket(actor, actorName, id, { body }) {
  const ticket = await repo.getTicketById(id);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  const message = await repo.createTicketMessage({
    ticket_id: id,
    sender: 'staff',
    author_name: actorName,
    body: encryptField(body),
  });
  await logActivity(actor, 'ticket.reply', `Replied to ticket ${id} (${ticket.subject ?? 'no subject'})`);
  return { message: toMessageDTO(message) };
}

export async function resolveTicket(actor, id) {
  const row = await repo.resolveTicket(id);
  if (!row) throw ApiError.notFound('Ticket not found');
  await logActivity(actor, 'ticket.resolve', `Resolved ticket ${id} (${row.subject ?? 'no subject'})`);
  return { ticket: toTicketDTO(row) };
}

export default {
  listTickets,
  getTicket,
  replyToTicket,
  resolveTicket,
};
