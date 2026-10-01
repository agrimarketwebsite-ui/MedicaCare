// backend/tests/public.unit.test.js
// Phase 3 — unit tests (walang DB): validation schemas para sa public modules.

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

let doctorValidation, storyValidation, contactValidation;
before(async () => {
  doctorValidation = await import('../modules/doctors/doctor.validation.js');
  storyValidation = await import('../modules/stories/story.validation.js');
  contactValidation = await import('../modules/contact/contact.validation.js');
});

describe('doctor.validation — listDoctorsQuerySchema', () => {
  it('defaults: limit 50, offset 0', () => {
    const out = doctorValidation.listDoctorsQuerySchema.parse({});
    assert.equal(out.limit, 50);
    assert.equal(out.offset, 0);
  });
  it('tumataanggap ng specialty/search/status; nirereject ang bad status at sobrang limit', () => {
    const out = doctorValidation.listDoctorsQuerySchema.parse({
      specialty: 'Cardiology', search: 'cruz', status: 'available', limit: '10', offset: '5',
    });
    assert.equal(out.specialty, 'Cardiology');
    assert.equal(out.limit, 10);
    assert.throws(() => doctorValidation.listDoctorsQuerySchema.parse({ status: 'sleeping' }));
    assert.throws(() => doctorValidation.listDoctorsQuerySchema.parse({ limit: 500 }));
  });
  it('doctorIdParam: valid uuid pumapasa, hindi-uuid ay 400', () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    assert.equal(doctorValidation.doctorIdParamSchema.parse({ id: uuid }).id, uuid);
    assert.throws(() => doctorValidation.doctorIdParamSchema.parse({ id: 'specialties' }));
    assert.throws(() => doctorValidation.doctorIdParamSchema.parse({ id: 'd1' }));
  });
  it('isUuid helper', () => {
    assert.equal(doctorValidation.isUuid('00000000-0000-4000-8000-000000000001'), true);
    assert.equal(doctorValidation.isUuid('Cardiology'), false);
  });
});

describe('story.validation', () => {
  it('limit default 10, max 50', () => {
    assert.equal(storyValidation.listStoriesQuerySchema.parse({}).limit, 10);
    assert.throws(() => storyValidation.listStoriesQuerySchema.parse({ limit: 999 }));
  });
});

describe('contact.validation — contactSchema', () => {
  const good = { name: 'Juan Dela Cruz', email: 'Test@Example.COM', message: 'Gusto ko pong magpa-checkup sa cardiology.' };
  it('valid input: email nino-normalize sa lowercase', () => {
    const out = contactValidation.contactSchema.parse(good);
    assert.equal(out.email, 'test@example.com');
  });
  it('nirereject ang maikling message (<10), bad email, at sobrang haba', () => {
    assert.throws(() => contactValidation.contactSchema.parse({ ...good, message: 'hi' }), /10/);
    assert.throws(() => contactValidation.contactSchema.parse({ ...good, email: 'not-email' }));
    assert.throws(() => contactValidation.contactSchema.parse({ ...good, message: 'x'.repeat(2001) }));
  });
  it('.strict(): nirereject ang unknown fields', () => {
    assert.throws(() => contactValidation.contactSchema.parse({ ...good, handled_at: '2026-01-01' }));
  });
});
