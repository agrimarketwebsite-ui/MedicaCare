// backend/modules/adminPatients/adminPatient.validation.js
// Phase 6 — Admin Console: patient registry CRUD validation.
// Lahat .strict() (walang mass assignment).

import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_RE, 'Invalid id');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(160, 'Email is too long')
  .email('Enter a valid email address');

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Phone number is too long')
  .regex(/^[+()\-\\s\d]+$/, 'Enter a valid phone number')
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    },
    { message: 'Enter a valid phone number' },
  );

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'qwertyui', 'letmein1', 'welcome1', 'admin123', 'medicacare', 'medicacare1',
  'medicacare123', 'hospital1', 'patient123', 'doctor123', 'iloveyou1',
]);

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), {
    message: 'This password is too common — please choose a different one',
  });

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

const genderSchema = z.enum(['male', 'female', 'other']);

export const listPatientsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const patientIdParamSchema = z.object({ id: uuidSchema }).strict();

export const createPatientSchema = z
  .object({
    full_name: z.string().trim().min(3, 'Please enter the full name').max(120, 'Name is too long'),
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema.optional(),
    gender: genderSchema.optional(),
    date_of_birth: dateSchema.optional(),
    blood_type: z.string().trim().max(10).optional(),
    allergies: z.string().trim().max(500).optional(),
    address: z.string().trim().max(500).optional(),
    emergency_contact: z.string().trim().max(500).optional(),
    photo_url: z.string().trim().max(500).optional(),
  })
  .strict();

export const updatePatientSchema = z
  .object({
    full_name: z.string().trim().min(3, 'Please enter the full name').max(120, 'Name is too long').optional(),
    phone: phoneSchema.optional(),
    gender: genderSchema.optional(),
    date_of_birth: dateSchema.optional(),
    blood_type: z.string().trim().max(10).optional(),
    allergies: z.string().trim().max(500).optional(),
    address: z.string().trim().max(500).optional(),
    emergency_contact: z.string().trim().max(500).optional(),
    photo_url: z.string().trim().max(500).optional(),
    email_reminders: z.boolean().optional(),
    portal_notifications: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export default {
  listPatientsQuerySchema,
  patientIdParamSchema,
  createPatientSchema,
  updatePatientSchema,
};
