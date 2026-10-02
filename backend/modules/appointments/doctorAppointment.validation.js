// backend/modules/appointments/doctorAppointment.validation.js
// Phase 5 — Zod schemas para sa doctor-scoped appointment endpoints.
// Lahat .strict(). Ang doctor ay nakikita lang ang SARILING appointments
// (ang BOLA scoping ay nasa service via resolveDoctorId).

import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid id');

const calendarDateSchema = (label) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
    .refine(
      (v) => {
        const [y, m, d] = v.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
      },
      { message: `${label} is not a valid calendar date` },
    );

export const doctorAppointmentIdParamSchema = z
  .object({ id: uuidSchema })
  .strict();

export const doctorScheduleQuerySchema = z
  .object({
    date: calendarDateSchema('Date').optional(),
    from: calendarDateSchema('From').optional(),
    to: calendarDateSchema('To').optional(),
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no-show']).optional(),
    patient_id: z.string().uuid('Invalid patient id').optional(),
  })
  .strict()
  .refine((d) => d.from === undefined || d.to === undefined || d.from <= d.to, {
    message: 'to must be on or after from',
    path: ['to'],
  });

export const doctorWeekQuerySchema = z
  .object({ start: calendarDateSchema('Start').optional() })
  .strict();

/** Complete visit: ang visit notes ay required (10–500, tugma sa DB CHECK). */
export const completeVisitSchema = z
  .object({
    notes: z
      .string()
      .trim()
      .min(10, 'Visit notes must be at least 10 characters')
      .max(500, 'Visit notes are too long (max 500 characters)'),
  })
  .strict();

export default {
  doctorAppointmentIdParamSchema,
  doctorScheduleQuerySchema,
  doctorWeekQuerySchema,
  completeVisitSchema,
};
