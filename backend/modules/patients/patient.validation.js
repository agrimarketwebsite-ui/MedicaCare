// backend/modules/patients/patient.validation.js
// Phase 4 — Zod schemas para sa patient profile + family members.
// Security (ASVS V5.1):
//   - .strict() sa lahat — reject unknown fields (walang mass assignment:
//     ang `email` ay login identity at HINDI updatable dito; `password_hash`,
//     `role`, at `id` ay hindi kailanman tatanggapin sa body).
//   - Ang [ENC] length limits (allergies/address 500, emergency_contact 200)
//     ay tugma sa playbook: ang DB CHECKs ay wala na (migration 004), ang Zod
//     ang nagbabantay bago pa ma-encrypt (ang ciphertext ay laging mas mahaba).

import { z } from 'zod';
import { manilaToday } from '../../shared/utils/manilaTime.js';

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Phone number is too long')
  .regex(/^[+()\-\s\d]+$/, 'Enter a valid phone number')
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    },
    { message: 'Enter a valid phone number' },
  );

// YYYY-MM-DD: valid calendar date, hindi future, hindi bago 1900.
// (Ang DB column ay text na pagdating ng migration 004 — ciphertext o ISO.)
const pastDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine(
    (v) => {
      const [y, m, d] = v.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    },
    { message: 'Enter a valid calendar date' },
  )
  .refine((v) => v <= manilaToday(), { message: 'Date of birth cannot be in the future' })
  .refine((v) => v >= '1900-01-01', { message: 'Date of birth looks invalid' });

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Please enter your full name').max(100, 'Name is too long').optional(),
    phone: phoneSchema.optional(),
    gender: z.enum(['male', 'female', 'other']).nullable().optional(),
    date_of_birth: pastDateSchema.nullable().optional(),
    blood_type: z.enum(BLOOD_TYPES).nullable().optional(),
    allergies: z.string().trim().max(500, 'Allergies is too long (max 500 characters)').nullable().optional(),
    address: z.string().trim().max(500, 'Address is too long (max 500 characters)').nullable().optional(),
    emergency_contact: z
      .string()
      .trim()
      .max(200, 'Emergency contact is too long (max 200 characters)')
      .nullable()
      .optional(),
    email_reminders: z.boolean().optional(),
    portal_notifications: z.boolean().optional(),
  })
  .strict();

export const createFamilyMemberSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Please enter a name').max(100, 'Name is too long'),
    relation: z.string().trim().min(1, 'Please enter the relationship').max(60, 'Relationship is too long'),
    age: z.number().int('Age must be a whole number').min(0, 'Age cannot be negative').max(130, 'Age looks invalid').optional(),
  })
  .strict();

export const updateFamilyMemberSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Please enter a name').max(100, 'Name is too long').optional(),
    relation: z.string().trim().min(1, 'Please enter the relationship').max(60, 'Relationship is too long').optional(),
    age: z.number().int('Age must be a whole number').min(0, 'Age cannot be negative').max(130, 'Age looks invalid').nullable().optional(),
  })
  .strict();

export const familyMemberIdParamSchema = z
  .object({ id: z.string().uuid('Invalid family member id') })
  .strict();

export default {
  updateProfileSchema,
  createFamilyMemberSchema,
  updateFamilyMemberSchema,
  familyMemberIdParamSchema,
};
