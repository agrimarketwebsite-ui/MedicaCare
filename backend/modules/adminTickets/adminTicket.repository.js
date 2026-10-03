// backend/modules/adminTickets/adminTicket.repository.js
// Phase 6 — Admin Console: support_tickets + support_ticket_messages
// persistence (admin scope — requireRole('admin')). Ang message body ay
// [ENC] (NAKA-ENCRYPT pagdating dito — ang service ang nag-encrypt).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminTicket.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const TICKET_COLS = 'id, patient_id, subject, status, created_at, updated_at, patients(id, full_name, email)';
const MESSAGE_COLS = 'id, ticket_id, sender, author_name, body, created_at';

export async function listTickets({ status } = {}) {
  let query = supabase.from('support_tickets').select(TICKET_COLS);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  return must({ data, error }, 'listTickets');
}

export async function getTicketById(id) {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(TICKET_COLS)
    .eq('id', id)
    .maybeSingle();
  return must({ data, error }, 'getTicketById');
}

export async function listTicketMessages(ticketId) {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select(MESSAGE_COLS)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return must({ data, error }, 'listTicketMessages');
}

export async function createTicketMessage({ ticket_id, sender, author_name, body }) {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({ ticket_id, sender, author_name, body })
    .select(MESSAGE_COLS)
    .single();
  return must({ data, error }, 'createTicketMessage');
}

export async function resolveTicket(id) {
  const { data, error } = await supabase
    .from('support_tickets')
    .update({ status: 'resolved' })
    .eq('id', id)
    .select(TICKET_COLS)
    .maybeSingle();
  return must({ data, error }, 'resolveTicket');
}

export default {
  listTickets,
  getTicketById,
  listTicketMessages,
  createTicketMessage,
  resolveTicket,
};
