// backend/modules/adminReports/adminReport.validation.js
// Phase 6 — Admin Console: reports validation. Ang /export.csv ay tumatanggap
// ng optional na status/date filters (parehong strict).

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const calendarDateSchema = z
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

export const exportCsvQuerySchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no-show']).optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    doctor_id: z.string().regex(UUID_RE, 'Invalid doctor id').optional(),
  })
  .strict()
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: 'from must not be after to',
    path: ['from'],
  });

export default {
  exportCsvQuerySchema,
};
