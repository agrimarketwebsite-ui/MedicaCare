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

export default { listDoctorsQuerySchema, doctorIdParamSchema, isUuid };
