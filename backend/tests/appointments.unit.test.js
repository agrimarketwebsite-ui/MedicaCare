// backend/tests/appointments.unit.test.js
// Phase 4 — unit tests (walang DB): validation schemas para sa patient
// portal core, ang patient status-transition matrix, at ang [ENC] row
// helpers (encryptRow/decryptRow) — kasama ang legacy-plaintext tolerance.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://dummy.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40);
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.BREVO_API_KEY = 'xkeysib-dummy';
process.env.EMAIL_FROM_NAME = 'Test';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

let patientValidation, appointmentValidation, ratingValidation;
let patientService, appointmentService, manilaTime;
before(async () => {
  patientValidation = await import('../modules/patients/patient.validation.js');
  appointmentValidation = await import('../modules/appointments/appointment.validation.js');
  ratingValidation = await import('../modules/ratings/rating.validation.js');
  patientService = await import('../modules/patients/patient.service.js');
  appointmentService = await import('../modules/appointments/appointment.service.js');
  manilaTime = await import('../shared/utils/manilaTime.js');
});

const UUID = '00000000-0000-4000-8000-000000000001';

describe('patient.validation — updateProfileSchema', () => {
  it('tumatanggap ng valid patch; lahat optional', () => {
    const out = patientValidation.updateProfileSchema.parse({
      full_name: 'Juan Dela Cruz',
      phone: '+63 917 123 4567',
      gender: 'male',
      date_of_birth: '1990-05-05',
      blood_type: 'O+',
      allergies: 'Penicillin',
      address: 'Quezon City',
      emergency_contact: 'Maria • +63 918 000 0000',
      email_reminders: false,
      portal_notifications: true,
    });
    assert.equal(out.blood_type, 'O+');
    assert.equal(patientValidation.updateProfileSchema.parse({}).full_name, undefined);
  });
  it('.strict(): nirereject ang email/password_hash/role (walang mass assignment)', () => {
    assert.throws(() => patientValidation.updateProfileSchema.parse({ email: 'a@b.c' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ password_hash: 'x' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ role: 'admin' }));
  });
  it('date_of_birth: future, <1900, at bad format ay rejected', () => {
    assert.throws(() => patientValidation.updateProfileSchema.parse({ date_of_birth: '2999-01-01' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ date_of_birth: '1899-12-31' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ date_of_birth: '05/05/1990' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ date_of_birth: '1990-13-40' }));
    assert.equal(patientValidation.updateProfileSchema.parse({ date_of_birth: null }).date_of_birth, null);
  });
  it('phone/blood_type/gender: invalid values rejected, null pinapayagan', () => {
    assert.throws(() => patientValidation.updateProfileSchema.parse({ phone: 'abc' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ blood_type: 'X+' }));
    assert.throws(() => patientValidation.updateProfileSchema.parse({ gender: 'x' }));
    assert.equal(patientValidation.updateProfileSchema.parse({ gender: null }).gender, null);
    assert.throws(() => patientValidation.updateProfileSchema.parse({ allergies: 'x'.repeat(501) }));
  });
});

describe('patient.validation — family schemas', () => {
  it('create: valid; age optional; .strict() rejects unknown', () => {
    const out = patientValidation.createFamilyMemberSchema.parse({ full_name: 'Maria', relation: 'Mother', age: 60 });
    assert.equal(out.age, 60);
    assert.equal(patientValidation.createFamilyMemberSchema.parse({ full_name: 'Jose', relation: 'Father' }).age, undefined);
    assert.throws(() => patientValidation.createFamilyMemberSchema.parse({ full_name: 'A', relation: 'B', patient_id: UUID }));
  });
  it('age bounds: negative at >130 rejected; null pinapayagan sa update', () => {
    assert.throws(() => patientValidation.createFamilyMemberSchema.parse({ full_name: 'A', relation: 'B', age: -1 }));
    assert.throws(() => patientValidation.createFamilyMemberSchema.parse({ full_name: 'A', relation: 'B', age: 200 }));
    assert.equal(patientValidation.updateFamilyMemberSchema.parse({ age: null }).age, null);
    assert.throws(() => patientValidation.updateFamilyMemberSchema.parse({ id: UUID }));
  });
  it('familyMemberIdParamSchema: uuid lang', () => {
    assert.equal(patientValidation.familyMemberIdParamSchema.parse({ id: UUID }).id, UUID);
    assert.throws(() => patientValidation.familyMemberIdParamSchema.parse({ id: 'd1' }));
  });
});

describe('appointment.validation — createAppointmentSchema', () => {
  const good = () => ({
    doctor_id: UUID,
    appointment_date: '2999-06-15',
    start_time: '09:00',
    reason: 'Masakit ang ulo',
    contact_number: '+63 917 123 4567',
  });
  it('valid input + defaults (duration 30, is_first_visit true)', () => {
    const out = appointmentValidation.createAppointmentSchema.parse(good());
    assert.equal(out.duration_minutes, 30);
    assert.equal(out.is_first_visit, true);
  });
  it('.strict(): nirereject ang patient_id/status (BOLA — hindi pwedeng i-spoof)', () => {
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), patient_id: UUID }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), status: 'confirmed' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), reference_code: 'AP-1' }));
  });
  it('past date rejected; bad uuid rejected; bad time rejected', () => {
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), appointment_date: '2020-01-01' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), doctor_id: 'd1' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), start_time: '9:00' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), start_time: '24:00' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), start_time: '09-00' }));
  });
  it('reason/contact/duration bounds', () => {
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), reason: '' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), reason: 'x'.repeat(501) }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), contact_number: 'abc' }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), duration_minutes: 10 }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), duration_minutes: 121 }));
    assert.equal(appointmentValidation.createAppointmentSchema.parse({ ...good(), duration_minutes: 15 }).duration_minutes, 15);
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), additional_notes: 'x'.repeat(1001) }));
    assert.throws(() => appointmentValidation.createAppointmentSchema.parse({ ...good(), family_member_id: 'nope' }));
  });
});

describe('appointment.validation — slotsQuerySchema / list / reschedule', () => {
  it('slots: defaults duration 30; coerce ng string; past date rejected', () => {
    const out = appointmentValidation.slotsQuerySchema.parse({ doctor_id: UUID, date: '2999-06-15' });
    assert.equal(out.duration, 30);
    assert.equal(appointmentValidation.slotsQuerySchema.parse({ doctor_id: UUID, date: '2999-06-15', duration: '45' }).duration, 45);
    assert.throws(() => appointmentValidation.slotsQuerySchema.parse({ doctor_id: UUID, date: '2020-01-01' }));
    assert.throws(() => appointmentValidation.slotsQuerySchema.parse({ doctor_id: UUID, date: '2999-06-15', duration: 10 }));
  });
  it('list: status enum lang; reschedule: strict + past date rejected', () => {
    assert.equal(appointmentValidation.listAppointmentsQuerySchema.parse({}).status, undefined);
    assert.equal(appointmentValidation.listAppointmentsQuerySchema.parse({ status: 'completed' }).status, 'completed');
    assert.throws(() => appointmentValidation.listAppointmentsQuerySchema.parse({ status: 'sleeping' }));
    const r = appointmentValidation.rescheduleSchema.parse({ appointment_date: '2999-06-15', start_time: '10:30' });
    assert.equal(r.duration_minutes, 30);
    assert.throws(() => appointmentValidation.rescheduleSchema.parse({ appointment_date: '2020-01-01', start_time: '10:30' }));
    assert.throws(() => appointmentValidation.rescheduleSchema.parse({ appointment_date: '2999-06-15', start_time: '10:30', status: 'cancelled' }));
    assert.throws(() => appointmentValidation.appointmentIdParamSchema.parse({ id: 'nope' }));
  });
});

describe('rating.validation — createRatingSchema', () => {
  it('valid; stars 1–5 lang; .strict()', () => {
    const out = ratingValidation.createRatingSchema.parse({ appointment_id: UUID, stars: 5, comment: 'Magaling!' });
    assert.equal(out.stars, 5);
    assert.throws(() => ratingValidation.createRatingSchema.parse({ appointment_id: UUID, stars: 0 }));
    assert.throws(() => ratingValidation.createRatingSchema.parse({ appointment_id: UUID, stars: 6 }));
    assert.throws(() => ratingValidation.createRatingSchema.parse({ appointment_id: UUID, stars: 4.5 }));
    assert.throws(() => ratingValidation.createRatingSchema.parse({ appointment_id: UUID, stars: 5, doctor_id: UUID }));
    assert.throws(() => ratingValidation.createRatingSchema.parse({ appointment_id: 'nope', stars: 5 }));
    assert.throws(() => ratingValidation.createRatingSchema.parse({ appointment_id: UUID, stars: 5, comment: 'x'.repeat(501) }));
  });
});

describe('appointment.service — status transition matrix', () => {
  it("cancel: pending/confirmed lang; completed/cancelled/no-show → false", () => {
    const { patientCancelAllowed } = appointmentService;
    assert.equal(patientCancelAllowed('pending'), true);
    assert.equal(patientCancelAllowed('confirmed'), true);
    assert.equal(patientCancelAllowed('completed'), false);
    assert.equal(patientCancelAllowed('cancelled'), false);
    assert.equal(patientCancelAllowed('no-show'), false);
  });
  it('reschedule: parehong matrix', () => {
    const { patientRescheduleAllowed } = appointmentService;
    assert.equal(patientRescheduleAllowed('pending'), true);
    assert.equal(patientRescheduleAllowed('confirmed'), true);
    assert.equal(patientRescheduleAllowed('completed'), false);
    assert.equal(patientRescheduleAllowed('no-show'), false);
  });
  it('normalizeTime / addMinutesToTime', () => {
    assert.equal(appointmentService.normalizeTime('09:00'), '09:00:00');
    assert.equal(appointmentService.normalizeTime('09:00:00'), '09:00:00');
    assert.equal(appointmentService.normalizeTime('09:00:00.000000'), '09:00:00'); // microseconds strip
    assert.equal(appointmentService.addMinutesToTime('09:00', 30), '09:30:00');
    assert.equal(appointmentService.addMinutesToTime('23:45', 30), '00:15:00');
    assert.equal(appointmentService.addMinutesToTime('16:00', 90), '17:30:00');
  });
});

describe('appointment.service — toAppointmentDTO rated flag', () => {
  const row = () => ({
    id: UUID,
    reference_code: 'AP-000123',
    doctor_id: UUID,
    patient_id: UUID,
    appointment_date: '2026-10-05',
    start_time: '09:00:00',
    end_time: '09:30:00',
    reason: 'Checkup',
    booked_for: null,
    is_first_visit: true,
    status: 'completed',
    created_at: '2026-10-01T08:00:00.000Z',
    doctors: { id: UUID, full_name: 'Dr. Test', specialties: { name: 'Cardiology' } },
  });
  it('rated: true kapag sinabi ng caller (may visit_ratings row)', () => {
    const dto = appointmentService.toAppointmentDTO(row(), { rated: true });
    assert.equal(dto.rated, true);
  });
  it('rated: false kapag walang rating / hindi ipinasa (default)', () => {
    assert.equal(appointmentService.toAppointmentDTO(row(), { rated: false }).rated, false);
    assert.equal(appointmentService.toAppointmentDTO(row()).rated, false);
  });
  it('detail DTO: rated + status_history sabay; ang doctors embed ay flattened', () => {
    const dto = appointmentService.toAppointmentDTO(row(), {
      detail: true,
      rated: true,
      statusHistory: [{ from_status: null, to_status: 'completed', created_at: '2026-10-01T09:30:00.000Z' }],
    });
    assert.equal(dto.rated, true);
    assert.equal(dto.status_history.length, 1);
    assert.equal(dto.doctor.full_name, 'Dr. Test');
    assert.equal(dto.doctor.specialty_name, 'Cardiology');
    assert.ok(!('doctors' in dto), 'walang raw embed sa DTO');
  });
});

describe('patient.service — encryptRow/decryptRow (PHI roundtrip)', () => {
  const row = {
    full_name: 'Juan Dela Cruz', // hindi [ENC] — hindi gagalawin
    email: 'juan@example.com', // hindi [ENC]
    date_of_birth: '1991-04-12',
    blood_type: 'O+',
    allergies: 'Penicillin',
    address: '18 Sampaguita St., Quezon City',
    emergency_contact: 'Maria • +63 918 445 2201',
  };
  it('encryptRow: [ENC] → v1: ciphertext; iba ay untouched', () => {
    const enc = patientService.encryptRow(row);
    for (const f of patientService.PATIENT_ENC_FIELDS) {
      assert.ok(enc[f].startsWith('v1:'), `${f} ay naka-encrypt`);
      assert.ok(!enc[f].includes(row[f]), `${f} walang plaintext leak`);
    }
    assert.equal(enc.full_name, row.full_name);
    assert.equal(enc.email, row.email);
  });
  it('decryptRow: ciphertext → original (roundtrip)', () => {
    const dec = patientService.decryptRow(patientService.encryptRow(row));
    assert.deepEqual(dec, row);
  });
  it('decryptRow: legacy plaintext (hindi v1:) ay ibinabalik as-is', () => {
    const dec = patientService.decryptRow({ allergies: 'Penicillin', address: 'QC' });
    assert.equal(dec.allergies, 'Penicillin');
    assert.equal(dec.address, 'QC');
  });
  it('null/undefined ay mananatili (hindi nag-throw)', () => {
    const enc = patientService.encryptRow({ allergies: null, address: undefined, blood_type: 'A+' });
    assert.equal(enc.allergies, null);
    assert.equal(enc.address, undefined);
    const dec = patientService.decryptRow({ allergies: null });
    assert.equal(dec.allergies, null);
  });
  it('family fields: full_name/relation [ENC], age hindi', () => {
    const enc = patientService.encryptRow(
      { full_name: 'Maria', relation: 'Mother', age: 60 },
      patientService.FAMILY_ENC_FIELDS,
    );
    assert.ok(enc.full_name.startsWith('v1:'));
    assert.ok(enc.relation.startsWith('v1:'));
    assert.equal(enc.age, 60);
    const dec = patientService.decryptRow(enc, patientService.FAMILY_ENC_FIELDS);
    assert.deepEqual(dec, { full_name: 'Maria', relation: 'Mother', age: 60 });
  });
});

describe('manilaTime helpers', () => {
  it("manilaToday() ay 'YYYY-MM-DD' at tugma sa Intl", () => {
    const today = manilaTime.manilaToday();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    assert.equal(today, expected);
  });
  it("manilaNowHHMM() ay 'HH:MM' 24-hour", () => {
    assert.match(manilaTime.manilaNowHHMM(), /^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
