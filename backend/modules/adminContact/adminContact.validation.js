// backend/modules/adminContact/adminContact.validation.js
// Phase 6 — Admin Console: contact message management validation.
// Lahat .strict().

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const messageIdParamSchema = z
  .object({
    id: z.string().regex(UUID_RE, 'Invalid message id'),
  })
  .strict();

export default {
  messageIdParamSchema,
};
