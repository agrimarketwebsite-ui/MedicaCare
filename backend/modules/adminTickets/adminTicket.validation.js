// backend/modules/adminTickets/adminTicket.validation.js
// Phase 6 — Admin Console: support ticket management validation.
// Lahat .strict(). Ang reply body ay 1-500 chars (schema convention).

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const listTicketsQuerySchema = z
  .object({
    status: z.enum(['open', 'resolved']).optional(),
  })
  .strict();

export const ticketIdParamSchema = z
  .object({
    id: z.string().regex(UUID_RE, 'Invalid ticket id'),
  })
  .strict();

export const replySchema = z
  .object({
    body: z.string().trim().min(1, 'Message cannot be empty').max(500, 'Message is too long (max 500 characters)'),
  })
  .strict();

export default {
  listTicketsQuerySchema,
  ticketIdParamSchema,
  replySchema,
};
