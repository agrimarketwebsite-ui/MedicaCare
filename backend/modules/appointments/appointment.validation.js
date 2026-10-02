// backend/modules/appointments/appointment.validation.js
// Phase 4 — Zod schemas para sa slots query + booking + reschedule.
// Lahat .strict(). Ang slot-grid alignment at within-clinic-hours check ay
// ginagawa ng fn_available_slots sa service (kailangan ng DB) — dito,
// format/range validation lang. Ang "hindi pwedeng past date" ay naka-base sa
// Manila wall-clock (manilaTime.js).

import { z } from 'zod';
import { manilaToday } from '../../shared/utils/manilaTime.js';

const uuidSchema = z.string().uuid('Invalid id');

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid contact number')
  .max(20, 'Contact number is too long')
  .regex(/^[+()\-\s\d]+$/, 'Enter a valid contact number')
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    },
    { message: 'Enter a valid contact number' },
  );

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

const notPastDateSchema = (label) =>
  calendarDateSchema(label).refine((v) => v >= manilaToday(), {
    message: `${label} cannot be in the past`,
  });

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour) format');

// z.coerce: ang query params ay strings ("30" → 30); ang JSON body numbers
// ay dumadaan lang. Default 30 kapag hindi binigay.
const durationSchema = z.coerce.number().int().min(15, 'Duration must be 15–120 minutes').max(120, 'Duration must be 15–120 minutes').default(30);

export const slotsQuerySchema = z
  .object({
    doctor_id: uuidSchema,
    date: notPastDateSchema('Date'),
    duration: durationSchema,
  })
  .strict();

export const createAppointmentSchema = z
  .object({
    doctor_id: uuidSchema,
    appointment_date: notPastDateSchema('Appointment date'),
    start_time: timeSchema,
    duration_minutes: durationSchema,
    reason: z
      .string()
      .trim()
      .min(1, 'Please describe the reason for your visit')
      .max(500, 'Reason is too long (max 500 characters)'),
    additional_notes: z.string().trim().max(1000, 'Notes are too long (max 1000 characters)').optional(),
    contact_number: phoneSchema,
    is_first_visit: z.boolean().default(true),
    family_member_id: uuidSchema.optional(),
  })
  .strict();

export const listAppointmentsQuerySchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no-show']).optional(),
  })
  .strict();

export const appointmentIdParamSchema = z.object({ id: uuidSchema }).strict();

export const rescheduleSchema = z
  .object({
    appointment_date: notPastDateSchema('Appointment date'),
    start_time: timeSchema,
    duration_minutes: durationSchema,
  })
  .strict();

export default {
  slotsQuerySchema,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  appointmentIdParamSchema,
  rescheduleSchema,
};
