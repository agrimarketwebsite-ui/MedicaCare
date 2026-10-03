// backend/modules/adminRecords/adminRecord.validation.js
// Phase 6 — Admin Console: labs & medications encoding validation.
// Lahat .strict(). Ang findings ay JSON array (ini-encrypt bilang JSON
// string ng ciphertext, mirror ng records module).

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_RE, 'Invalid id');

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

const patientQuerySchema = z
  .object({
    patient_id: uuidSchema,
  })
  .strict();

const recordIdParamSchema = z.object({ id: uuidSchema }).strict();

// ---- lab_results ----

const labStatusSchema = z.enum(['pending', 'final']);

const labFields = {
  test_name: z.string().trim().min(1, 'Test name is required').max(200, 'Test name is too long'),
  category: z.string().trim().max(80),
  status: labStatusSchema,
  result_date: calendarDateSchema,
  findings: z.array(z.any()),
};

export const listLabsQuerySchema = patientQuerySchema;

export const createLabSchema = z
  .object({
    patient_id: uuidSchema,
    ...labFields,
    status: labFields.status.default('pending'),
    findings: labFields.findings.default([]),
  })
  .strict();

export const updateLabSchema = z
  .object(
    Object.fromEntries(Object.entries(labFields).map(([k, v]) => [k, v.optional()])),
  )
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// ---- medications ----

const medicationFields = {
  name: z.string().trim().min(1, 'Medication name is required').max(200, 'Name is too long'),
  dose: z.string().trim().max(80),
  form: z.string().trim().max(60),
  frequency: z.string().trim().max(80),
  start_date: calendarDateSchema,
  status: z.string().trim().max(40),
  instructions: z.string().trim().max(1000, 'Instructions are too long (max 1000 characters)'),
};

export const listMedicationsQuerySchema = patientQuerySchema;

export const createMedicationSchema = z
  .object({
    patient_id: uuidSchema,
    doctor_id: uuidSchema, // prescriber — NOT NULL sa schema
    appointment_id: uuidSchema.optional(),
    ...medicationFields,
  })
  .strict();

export const updateMedicationSchema = z
  .object(
    Object.fromEntries(Object.entries(medicationFields).map(([k, v]) => [k, v.optional()])),
  )
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export { recordIdParamSchema };

export default {
  listLabsQuerySchema,
  createLabSchema,
  updateLabSchema,
  listMedicationsQuerySchema,
  createMedicationSchema,
  updateMedicationSchema,
  recordIdParamSchema,
};
