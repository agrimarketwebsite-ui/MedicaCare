// backend/modules/adminDoctors/adminDoctor.validation.js
// Phase 6 — Admin Console: doctor CRUD + availability editor + portal access
// validation. Lahat .strict(). Ang availability schemas ay muling ginagamit
// mula sa doctors module (iisang source of truth para sa weekday 1-7 ISO).

import { z } from 'zod';
import {
  availabilitySchema,
  availabilityUpdateSchema,
  availabilityIdParamSchema,
} from '../doctors/doctor.validation.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_RE, 'Invalid id');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(160, 'Email is too long')
  .email('Enter a valid email address');

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

const doctorStatusSchema = z.enum(['available', 'busy', 'on-leave']);
const genderSchema = z.enum(['male', 'female', 'other']);

const doctorFields = {
  full_name: z.string().trim().min(3, 'Please enter the full name').max(120, 'Name is too long'),
  specialty_id: uuidSchema,
  status: doctorStatusSchema,
  years_of_experience: z.number().int().min(0).max(80),
  consultation_fee: z.number().min(0).max(1000000),
  room: z.string().trim().max(60),
  gender: genderSchema,
  photo_url: z.string().trim().max(500),
};

export const listDoctorsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    specialty: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const doctorIdParamSchema = z.object({ id: uuidSchema }).strict();

export const createDoctorSchema = z
  .object({
    ...doctorFields,
    status: doctorFields.status.default('available'),
  })
  .strict();

export const updateDoctorSchema = z
  .object(
    Object.fromEntries(Object.entries(doctorFields).map(([k, v]) => [k, v.optional()])),
  )
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const portalAccessSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export { availabilitySchema, availabilityUpdateSchema, availabilityIdParamSchema };

export default {
  listDoctorsQuerySchema,
  doctorIdParamSchema,
  createDoctorSchema,
  updateDoctorSchema,
  portalAccessSchema,
  availabilitySchema,
  availabilityUpdateSchema,
  availabilityIdParamSchema,
};
