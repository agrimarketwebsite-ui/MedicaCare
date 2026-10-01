// backend/modules/auth/auth.validation.js
// Phase 2 — Zod schemas para sa auth endpoints.
// Security (ASVS V2.1/V5.1):
//   - password: min 8 / max 128 + strength rule (letter + number) + tsek laban
//     sa common passwords; strict email/phone formats.
//   - .strict() sa lahat — reject unknown fields (walang mass assignment:
//     hindi pwedeng ipilit ang `role`, `password_hash`, o `is_admin` sa body).
//   - Ang login password ay min(1) lang — ang strength policy ay sa REGISTER
//     lang ine-enforce (ang login ay nagve-verify lang ng hash).

import { z } from 'zod';

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
  .regex(/^[+()\-\s\d]+$/, 'Enter a valid phone number')
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    },
    { message: 'Enter a valid phone number' },
  );

// Maliit na blocklist ng pinaka-common na passwords (ASVS V2.1 — hindi sapat
// ang length rule lang). Full breach-corpus check ay Phase 10 (HaveIBeenPwned).
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

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(3, 'Please enter your full name').max(120, 'Name is too long'),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128),
    // Source hint: kapag wala, susubukan ang patients → admins → doctor_accounts
    // at ang role ay derived sa tumugmang source (BACKEND_ARCHITECTURE §6.1).
    role: z.enum(['patient', 'admin', 'doctor']).optional(),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32, 'Invalid reset token').max(256, 'Invalid reset token'),
    password: passwordSchema,
  })
  .strict();

export default { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema };
