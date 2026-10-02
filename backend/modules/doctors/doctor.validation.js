// backend/modules/doctors/doctor.validation.js
// Phase 3 — query/param validation para sa public doctor directory.
// Security (ASVS V5.1): strict formats; ang limit/offset ay may caps para
// hindi ma-scrape nang mabilis ang buong directory sa isang request.

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const listDoctorsQuerySchema = z.object({
  // specialty: UUID (specialty_id) o name (case-insensitive) — alinman.
  specialty: z.string().trim().min(1).max(120).optional(),
  // search: hinahanap sa full_name (at specialty name — resolved sa service).
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['available', 'busy', 'on-leave']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const doctorIdParamSchema = z.object({
  id: z.string().regex(UUID_RE, 'Invalid doctor id'),
});

export const isUuid = (v) => UUID_RE.test(v);

// ------------------------------------------------------------
// Phase 5 — doctor portal: weekly availability editor.
// ------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const availabilitySchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    start_time: z.string().regex(TIME_RE, 'Invalid start_time (HH:MM)'),
    end_time: z.string().regex(TIME_RE, 'Invalid end_time (HH:MM)'),
  })
  .strict()
  .refine((d) => d.start_time < d.end_time, {
    message: 'end_time must be after start_time',
    path: ['end_time'],
  });

export const availabilityUpdateSchema = z
  .object({
    weekday: z.number().int().min(1).max(7).optional(),
    start_time: z.string().regex(TIME_RE, 'Invalid start_time (HH:MM)').optional(),
    end_time: z.string().regex(TIME_RE, 'Invalid end_time (HH:MM)').optional(),
  })
  .strict()
  .refine(
    (d) => d.start_time === undefined || d.end_time === undefined || d.start_time < d.end_time,
    { message: 'end_time must be after start_time', path: ['end_time'] },
  );

export const availabilityIdParamSchema = z.object({
  availId: z.string().regex(UUID_RE, 'Invalid availability id'),
});

export default { listDoctorsQuerySchema, doctorIdParamSchema, isUuid, availabilitySchema, availabilityUpdateSchema, availabilityIdParamSchema };
