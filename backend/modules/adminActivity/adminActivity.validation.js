// backend/modules/adminActivity/adminActivity.validation.js
// Phase 6 — Admin Console: audit trail read validation.
// Lahat .strict().

import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine(
    (v) => {
      const [y, m, d] = v.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    },
    { message: 'Date is not a valid calendar date' },
  );

export const listActivityQuerySchema = z
  .object({
    actor: z.string().trim().min(1).max(120).optional(),
    action: z.string().trim().min(1).max(120).optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: 'from must not be after to',
    path: ['from'],
  });

export default {
  listActivityQuerySchema,
};
