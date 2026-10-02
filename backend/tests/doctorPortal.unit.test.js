// backend/tests/doctorPortal.unit.test.js
// Phase 5 — unit tests (walang DB): doctor status transition matrix,
// weekRangeContaining, availability/complete-visit validation schemas, at
// [ENC] roundtrip para sa records fields (incl. findings bilang JSON string
// ng base64 ciphertext).

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://dummy.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40);
process.env.JWT_ACCESS_SECRET = 'y'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'z'.repeat(40);
process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.BREVO_API_KEY = 'xkeysib-' + 'w'.repeat(32);
process.env.EMAIL_FROM_NAME = 'Test';
process.env.EMAIL_FROM_ADDRESS = 'test@example.com';

let doctorCompleteAllowed, doctorNoShowAllowed, weekRangeContaining;
let availabilitySchema, availabilityUpdateSchema, completeVisitSchema;
let createMedicalRecordSchema, updateMedicalRecordSchema, createLabResultSchema, createMedicationSchema;
let decryptFindings, decryptRow, encryptFindings, encryptRow;
let LAB_RESULT_ENC_FIELDS, MEDICAL_RECORD_ENC_FIELDS, MEDICATION_ENC_FIELDS;

before(async () => {
  ({ doctorCompleteAllowed, doctorNoShowAllowed, weekRangeContaining } =
    await import('../modules/appointments/doctorAppointment.service.js'));
  ({ availabilitySchema, availabilityUpdateSchema } =
    await import('../modules/doctors/doctor.validation.js'));
  ({ completeVisitSchema } =
    await import('../modules/appointments/doctorAppointment.validation.js'));
  ({
    createMedicalRecordSchema,
    updateMedicalRecordSchema,
    createLabResultSchema,
    createMedicationSchema,
  } = await import('../modules/records/record.validation.js'));
  ({
    decryptFindings,
    decryptRow,
    encryptFindings,
    encryptRow,
    LAB_RESULT_ENC_FIELDS,
    MEDICAL_RECORD_ENC_FIELDS,
    MEDICATION_ENC_FIELDS,
  } = await import('../modules/records/record.service.js'));
});

describe('doctorPortal — status transition matrix', () => {
  it('complete: pending/confirmed lang; completed/cancelled/no-show → false', () => {
    assert.equal(doctorCompleteAllowed('pending'), true);
    assert.equal(doctorCompleteAllowed('confirmed'), true);
    assert.equal(doctorCompleteAllowed('completed'), false);
    assert.equal(doctorCompleteAllowed('cancelled'), false);
    assert.equal(doctorNoShowAllowed('no-show'), false);
  });
  it('no-show: pending/confirmed lang; completed/cancelled/no-show → false', () => {
    assert.equal(doctorNoShowAllowed('pending'), true);
    assert.equal(doctorNoShowAllowed('confirmed'), true);
    assert.equal(doctorNoShowAllowed('completed'), false);
    assert.equal(doctorNoShowAllowed('cancelled'), false);
    assert.equal(doctorNoShowAllowed('no-show'), false);
  });
});

describe('doctorPortal — weekRangeContaining', () => {
  it('Monday–Sunday week para sa midweek date', () => {
    // 2026-10-02 ay Friday
    assert.deepEqual(weekRangeContaining('2026-10-02'), {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
    });
  });
  it('Monday mismo → sariling week', () => {
    assert.deepEqual(weekRangeContaining('2026-09-28'), {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
    });
  });
  it('Sunday → week na nagtatapos sa araw na iyon', () => {
    assert.deepEqual(weekRangeContaining('2026-10-04'), {
      week_start: '2026-09-28',
      week_end: '2026-10-04',
    });
  });
});

describe('doctorPortal — availability validation', () => {
  it('valid entry pumapasa', () => {
    const r = availabilitySchema.safeParse({ weekday: 1, start_time: '08:00', end_time: '12:00' });
    assert.equal(r.success, true);
  });
  it('.strict(): unknown field rejected; weekday bounds; end > start', () => {
    assert.equal(availabilitySchema.safeParse({ weekday: 0, start_time: '08:00', end_time: '12:00' }).success, false);
    assert.equal(availabilitySchema.safeParse({ weekday: 8, start_time: '08:00', end_time: '12:00' }).success, false);
    assert.equal(availabilitySchema.safeParse({ weekday: 1, start_time: '12:00', end_time: '08:00' }).success, false);
    assert.equal(availabilitySchema.safeParse({ weekday: 1, start_time: '08:00', end_time: '12:00', extra: 1 }).success, false);
    assert.equal(availabilitySchema.safeParse({ weekday: 1, start_time: '8:00', end_time: '12:00' }).success, false);
  });
  it('update: partial allowed; empty object ay valid (no-op)', () => {
    assert.equal(availabilityUpdateSchema.safeParse({}).success, true);
    assert.equal(availabilityUpdateSchema.safeParse({ start_time: '09:00' }).success, true);
    assert.equal(availabilityUpdateSchema.safeParse({ start_time: '14:00', end_time: '12:00' }).success, false);
  });
  it('completeVisitSchema: notes 10–500 required', () => {
    assert.equal(completeVisitSchema.safeParse({ notes: 'short' }).success, false);
    assert.equal(completeVisitSchema.safeParse({ notes: 'Sapat na haba ng visit notes dito.' }).success, true);
    assert.equal(completeVisitSchema.safeParse({}).success, false);
  });
});

describe('doctorPortal — records validation', () => {
  const base = {
    patient_id: '00000000-0000-4000-8000-000000000001',
    visit_date: '2026-10-01',
    record_type: 'Consultation',
    title: 'Follow-up',
    summary: 'Stable, continue meds.',
  };
  it('medical record: valid; .strict() rejects unknown', () => {
    assert.equal(createMedicalRecordSchema.safeParse(base).success, true);
    assert.equal(createMedicalRecordSchema.safeParse({ ...base, hacker: 1 }).success, false);
    assert.equal(updateMedicalRecordSchema.safeParse({}).success, false);
    assert.equal(updateMedicalRecordSchema.safeParse({ summary: 'Amended notes here.' }).success, true);
  });
  it('lab result: findings shape; status enum', () => {
    const lab = {
      patient_id: base.patient_id,
      test_name: 'CBC',
      result_date: '2026-10-01',
      findings: [{ item: 'Hemoglobin', value: '13.5', unit: 'g/dL', flag: 'low' }],
    };
    assert.equal(createLabResultSchema.safeParse(lab).success, true);
    assert.equal(createLabResultSchema.safeParse({ ...lab, status: 'weird' }).success, false);
    assert.equal(createLabResultSchema.safeParse({ ...lab, findings: [{ item: 'x' }] }).success, false);
  });
  it('medication: required fields; status enum', () => {
    const med = { patient_id: base.patient_id, name: 'Amlodipine', frequency: 'Once daily' };
    assert.equal(createMedicationSchema.safeParse(med).success, true);
    assert.equal(createMedicationSchema.safeParse({ patient_id: base.patient_id, frequency: 'Once daily' }).success, false);
  });
});

describe('doctorPortal — records [ENC] roundtrip', () => {
  it('medical_records: title/summary → v1: ciphertext; decrypt roundtrip', () => {
    const enc = encryptRow({ title: 'Hypertension follow-up', summary: 'BP 130/85, stable.' }, MEDICAL_RECORD_ENC_FIELDS);
    assert.ok(enc.title.startsWith('v1:'));
    assert.ok(enc.summary.startsWith('v1:'));
    const dec = decryptRow(enc, MEDICAL_RECORD_ENC_FIELDS);
    assert.equal(dec.title, 'Hypertension follow-up');
    assert.equal(dec.summary, 'BP 130/85, stable.');
  });
  it('medications: name/dose/instructions encrypted; form hindi', () => {
    const enc = encryptRow({ name: 'Amlodipine', dose: '5mg', form: 'tablet', instructions: 'After meals' }, MEDICATION_ENC_FIELDS);
    assert.ok(enc.name.startsWith('v1:'));
    assert.ok(enc.dose.startsWith('v1:'));
    assert.equal(enc.form, 'tablet');
    const dec = decryptRow(enc, MEDICATION_ENC_FIELDS);
    assert.equal(dec.name, 'Amlodipine');
  });
  it('findings: array → JSON string ng base64 ciphertext; decrypt → array', () => {
    const findings = [{ item: 'Hemoglobin', value: '13.5', unit: 'g/dL', flag: 'low' }];
    const stored = encryptFindings(findings);
    assert.ok(stored.startsWith('v1:'), 'findings ay naka-store bilang ciphertext string');
    const back = decryptFindings(stored);
    assert.deepEqual(back, findings);
  });
  it('findings: legacy plaintext array ay as-is; null ay null', () => {
    const legacy = [{ item: 'WBC', value: '7.0' }];
    assert.deepEqual(decryptFindings(legacy), legacy);
    assert.equal(decryptFindings(null), null);
  });
  it('decryptRow: hindi lahat ng fields ay encrypted (selective)', () => {
    const row = { test_name: 'CBC', category: 'Hematology', findings: encryptFindings([]) };
    const dec = decryptRow(encryptRow(row, ['test_name']), LAB_RESULT_ENC_FIELDS);
    assert.equal(dec.test_name, 'CBC');
    assert.equal(dec.category, 'Hematology');
    assert.deepEqual(dec.findings, []);
  });
});
