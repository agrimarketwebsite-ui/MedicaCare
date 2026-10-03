// backend/modules/adminSettings/adminSetting.validation.js
// Phase 6 — Admin Console: clinic info + appointment preferences write
// validation. Lahat .strict() — ang singleton rows (id=1) ay na-update lang,
// hindi nai-insert.

import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(160, 'Email is too long')
  .email('Enter a valid email address');

const atLeastOneField = (d) => Object.keys(d).length > 0;

export const clinicUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Clinic name is required').max(160).optional(),
    short_name: z.string().trim().min(1).max(60).optional(),
    tagline: z.string().trim().max(240).optional(),
    phone: z.string().trim().max(40).optional(),
    email: emailSchema.optional(),
    address: z.string().trim().max(500).optional(),
    // hours: JSONB per-day hours (hal. { "monday": "08:00–17:00", ... }),
    // o plain string mula sa admin form.
    hours: z.union([z.record(z.string(), z.any()), z.string().trim().max(500)]).optional(),
  })
  .strict()
  .refine(atLeastOneField, { message: 'No fields to update' });

export const appUpdateSchema = z
  .object({
    slot_interval_minutes: z
      .number()
      .int()
      .refine((v) => [15, 30, 60].includes(v), {
        message: 'slot_interval_minutes must be 15, 30, or 60',
      })
      .optional(),
    auto_confirm_appointments: z.boolean().optional(),
  })
  .strict()
  .refine(atLeastOneField, { message: 'No fields to update' });

export default {
  clinicUpdateSchema,
  appUpdateSchema,
};
