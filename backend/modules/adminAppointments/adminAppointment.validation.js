// backend/modules/adminAppointments/adminAppointment.validation.js
// Phase 6 — Admin Console: appointment management validation.
// Lahat .strict(). Ang status history timestamps ay DB-trigger written —
// hindi bahagi ng validation.

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_RE, 'Invalid id');

const appointmentStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no-show']);

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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z.string().regex(TIME_RE, 'Use HH:MM (24-hour) format');

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

export const listAppointmentsQuerySchema = z
  .object({
    date: calendarDateSchema.optional(),
    doctor_id: uuidSchema.optional(),
    status: appointmentStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const appointmentIdParamSchema = z.object({ id: uuidSchema }).strict();

export const createAppointmentSchema = z
  .object({
    doctor_id: uuidSchema,
    patient_id: uuidSchema,
    appointment_date: calendarDateSchema,
    start_time: timeSchema,
    duration_minutes: z.coerce
      .number()
      .int()
      .min(15, 'Duration must be 15–120 minutes')
      .max(120, 'Duration must be 15–120 minutes')
      .default(30),
    reason: z.string().trim().min(1, 'Please describe the reason for the visit').max(500, 'Reason is too long (max 500 characters)'),
    status: appointmentStatusSchema.default('pending'),
    booked_for: z.string().trim().max(120).optional(),
    is_first_visit: z.boolean().default(true),
    additional_notes: z.string().trim().max(1000, 'Notes are too long (max 1000 characters)').optional(),
    contact_number: phoneSchema.optional(),
  })
  .strict();

export const updateAppointmentSchema = z
  .object({
    doctor_id: uuidSchema.optional(),
    patient_id: uuidSchema.optional(),
    appointment_date: calendarDateSchema.optional(),
    start_time: timeSchema.optional(),
    end_time: timeSchema.optional(),
    reason: z.string().trim().min(1, 'Please describe the reason for the visit').max(500, 'Reason is too long (max 500 characters)').optional(),
    status: appointmentStatusSchema.optional(),
    booked_for: z.string().trim().max(120).nullable().optional(),
    is_first_visit: z.boolean().optional(),
    additional_notes: z.string().trim().max(1000, 'Notes are too long (max 1000 characters)').optional(),
    contact_number: phoneSchema.optional(),
  })
  .strict()
  .refine(
    (d) => d.start_time === undefined || d.end_time === undefined || d.start_time < d.end_time,
    { message: 'end_time must be after start_time', path: ['end_time'] },
  )
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const statusUpdateSchema = z
  .object({
    status: appointmentStatusSchema,
  })
  .strict();

export const completeVisitSchema = z
  .object({
    notes: z.string().trim().min(10, 'Visit notes must be at least 10 characters').max(500, 'Visit notes are too long (max 500 characters)'),
  })
  .strict();

export default {
  listAppointmentsQuerySchema,
  appointmentIdParamSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  statusUpdateSchema,
  completeVisitSchema,
};
