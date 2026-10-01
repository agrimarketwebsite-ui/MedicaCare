// backend/modules/contact/contact.validation.js
// Phase 3 — contact form validation.
// Ang limits ay tugma sa DB CHECK (message 10–2000 chars) — hindi pwedeng
// makalusot sa API ang hindi tatanggapin ng DB, at hindi rin sobrang haba
// ang naka-store (DoS via oversized payload).

import { z } from 'zod';

export const contactSchema = z
  .object({
    name: z.string().trim().min(1, 'Please enter your name').max(100, 'Name is too long'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Email is required')
      .max(160, 'Email is too long')
      .email('Enter a valid email address'),
    message: z
      .string()
      .trim()
      .min(10, 'Please provide a bit more detail (10+ characters)')
      .max(2000, 'Message is too long (max 2000 characters)'),
  })
  .strict();

export default { contactSchema };
