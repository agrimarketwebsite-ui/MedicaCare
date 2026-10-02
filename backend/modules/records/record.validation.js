// backend/modules/records/record.validation.js
// Phase 5 — Zod schemas para sa doctor-written records. Lahat .strict().
// Ang doctor ay makakasulat/makakabasa lang para sa pasyenteng may
// appointment sa kanya (ang relation check ay nasa service).

import { z } from 'zod';
import { manilaToday } from '../../shared/utils/manilaTime.js';

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

const notFutureDateSchema = (label) =>
  calendarDateSchema(label).refine((v) => v <= manilaToday(), {
    message: `${label} cannot be in the future`,
  });

export const patientQuerySchema = z
  .object({ patient_id: uuidSchema })
  .strict();

export const recordIdParamSchema = z
  .object({ id: uuidSchema })
  .strict();

export const createMedicalRecordSchema = z
  .object({
    patient_id: uuidSchema,
    appointment_id: uuidSchema.optional(),
    visit_date: notFutureDateSchema('Visit date'),
    record_type: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long (max 200 characters)'),
    summary: z.string().trim().min(1, 'Summary is required').max(2000, 'Summary is too long (max 2000 characters)'),
  })
  .strict();

export const updateMedicalRecordSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    summary: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((d) => d.title !== undefined || d.summary !== undefined, {
    message: 'Nothing to update',
  });

const findingSchema = z
  .object({
    item: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(200),
    unit: z.string().trim().max(40).optional(),
    range: z.string().trim().max(120).optional(),
    flag: z.enum(['high', 'low']).nullable().optional(),
  })
  .strict();

export const createLabResultSchema = z
  .object({
    patient_id: uuidSchema,
    test_name: z.string().trim().min(1, 'Test name is required').max(200, 'Test name is too long (max 200 characters)'),
    category: z.string().trim().max(120).optional(),
    status: z.enum(['final', 'pending']).default('final'),
    result_date: notFutureDateSchema('Result date'),
    findings: z.array(findingSchema).max(100).default([]),
  })
  .strict();

export const createMedicationSchema = z
  .object({
    patient_id: uuidSchema,
    appointment_id: uuidSchema.optional(),
    name: z.string().trim().min(1, 'Medication name is required').max(200, 'Name is too long (max 200 characters)'),
    dose: z.string().trim().max(120).optional(),
    form: z.string().trim().max(60).optional(),
    frequency: z.string().trim().min(1, 'Frequency is required').max(120),
    start_date: calendarDateSchema('Start date').optional(),
    status: z.enum(['active', 'completed']).default('active'),
    instructions: z.string().trim().max(1000, 'Instructions are too long (max 1000 characters)').optional(),
  })
  .strict();

export default {
  patientQuerySchema,
  recordIdParamSchema,
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  createLabResultSchema,
  createMedicationSchema,
};
