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
    name: z.string().trim().min(1, 'Clinic name is required').max(160),
    short_name: z.string().trim().min(1).max(60),
    tagline: z.string().trim().max(240),
    phone: z.string().trim().max(40),
    email: emailSchema,
    address: z.string().trim().max(500),
    // hours: JSONB per-day hours (hal. { "monday": "08:00–17:00", ... }).
    hours: z.record(z.string(), z.any()),
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
      }),
    auto_confirm_appointments: z.boolean(),
  })
  .strict()
  .refine(atLeastOneField, { message: 'No fields to update' });

export default {
  clinicUpdateSchema,
  appUpdateSchema,
};
