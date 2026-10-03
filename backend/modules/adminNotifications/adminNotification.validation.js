// backend/modules/adminNotifications/adminNotification.validation.js
// Phase 6 — Admin Console: notification management validation.
// Lahat .strict().

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_RE, 'Invalid id');

export const listNotificationsQuerySchema = z
  .object({
    patient_id: uuidSchema.optional(),
  })
  .strict();

export const createNotificationSchema = z
  .object({
    patient_id: uuidSchema,
    appointment_id: uuidSchema.optional(),
    type: z.string().trim().min(1, 'Type is required').max(40, 'Type is too long'),
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
    message: z.string().trim().min(1, 'Message is required').max(500, 'Message is too long (max 500 characters)'),
  })
  .strict();

export default {
  listNotificationsQuerySchema,
  createNotificationSchema,
};
