// backend/tests/public.test.js
// Phase 3 — integration: settings/doctors/stories/contact public endpoints.
// Kailangan ng backend/.env + Supabase; kung wala, naka-skip ang suite.
// Kasama ang acceptance check: ang contact [ENC] fields ay ciphertext sa DB.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

let H = null;
try {
  H = await import('./auth.helpers.js');
} catch {
  H = null;
}

describe('public integration — settings/doctors/stories/contact', { skip: !H }, () => {
  let base, server;

  before(async () => {
    ({ base, server } = await H.bootApp());
  });

  after(async () => {
    server?.close();
  });

  it('GET /settings/public → 200, may clinic + preferences', async () => {
    const r = await H.api(base, 'GET', '/settings/public');
    assert.equal(r.status, 200);
    assert.ok(r.json.data.clinic, 'may clinic');
    assert.ok(r.json.data.clinic.name, 'may clinic name');
    assert.ok(r.json.data.preferences, 'may preferences');
    assert.equal(typeof r.json.data.preferences.slot_interval_minutes, 'number');
  });

  it('GET /doctors/specialties → 200, array ng {id, name}', async () => {
    const r = await H.api(base, 'GET', '/doctors/specialties');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.data.specialties));
    assert.ok(r.json.data.specialties.length > 0);
    assert.ok(r.json.data.specialties[0].name);
  });

  it('GET /doctors → 200, may specialty_name at rating fields', async () => {
    const r = await H.api(base, 'GET', '/doctors?limit=5');
    assert.equal(r.status, 200);
    const { doctors, total } = r.json.data;
    assert.ok(Array.isArray(doctors) && doctors.length > 0);
    assert.ok(total >= doctors.length);
    const d = doctors[0];
    assert.ok(d.id && d.full_name && d.specialty_name, 'may id/full_name/specialty_name');
    assert.ok('avg_rating' in d && 'rating_count' in d, 'laging may rating fields');
  });

  it('GET /doctors?specialty=<name> → filtered; ?search= → tumatama', async () => {
    const specs = await H.api(base, 'GET', '/doctors/specialties');
    const specName = specs.json.data.specialties[0].name;
    const r = await H.api(base, 'GET', `/doctors?specialty=${encodeURIComponent(specName)}`);
    assert.equal(r.status, 200);
    assert.ok(r.json.data.doctors.length > 0);
    for (const d of r.json.data.doctors) {
      assert.equal(d.specialty_name, specName);
    }
    const s = await H.api(base, 'GET', '/doctors?search=zzz-no-such-doctor');
    assert.equal(s.status, 200);
    assert.equal(s.json.data.doctors.length, 0);
  });

  it('GET /doctors/:id → 200; bad uuid → 400; unknown uuid → 404', async () => {
    const list = await H.api(base, 'GET', '/doctors?limit=1');
    const id = list.json.data.doctors[0].id;
    const r = await H.api(base, 'GET', `/doctors/${id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.data.doctor.id, id);
    const bad = await H.api(base, 'GET', '/doctors/not-a-uuid');
    assert.equal(bad.status, 400);
    const missing = await H.api(base, 'GET', '/doctors/00000000-0000-4000-8000-000000009999');
    assert.equal(missing.status, 404);
  });

  it('GET /stories → 200, approved lang (walang patient_id)', async () => {
    const r = await H.api(base, 'GET', '/stories');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.data.stories));
    for (const s of r.json.data.stories) {
      assert.ok(s.display_name && s.quote, 'may display_name at quote');
      assert.ok(!('patient_id' in s), 'walang patient_id (PII)');
      assert.ok(!('reviewed_by' in s), 'walang reviewed_by (audit)');
    }
  });

  it('POST /contact → 201; ang [ENC] fields ay CIPHERTEXT sa DB', async () => {
    const uniq = `Test User ${Date.now()}`;
    const r = await H.api(base, 'POST', '/contact', {
      body: { name: uniq, email: 'contact.test@example.com', message: 'Gusto ko pong magtanong tungkol sa cardiology checkup.' },
    });
    assert.equal(r.status, 201);
    assert.ok(r.json.data.id);

    // Acceptance: i-verify sa DB na encrypted ang naka-store
    const { data } = await H.supabase
      .from('contact_messages')
      .select('id, name, email, message')
      .eq('id', r.json.data.id)
      .single();
    assert.ok(data.name.startsWith('v1:'), 'name ay ciphertext (v1:...)');
    assert.ok(data.email.startsWith('v1:'), 'email ay ciphertext');
    assert.ok(data.message.startsWith('v1:'), 'message ay ciphertext');
    assert.ok(!data.name.includes(uniq), 'walang plaintext leak');

    // Cleanup
    await H.supabase.from('contact_messages').delete().eq('id', r.json.data.id);
  });

  it('POST /contact invalid body → 400 (validation bago ang DB)', async () => {
    const r = await H.api(base, 'POST', '/contact', {
      body: { name: '', email: 'bad', message: 'short' },
    });
    assert.equal(r.status, 400);
    assert.ok(r.json.details && r.json.details.length > 0);
  });

  it('POST /contact ×6 nang mabilis → ang huli ay 429 (spam protection)', async () => {
    let last = null;
    const createdIds = [];
    for (let i = 0; i < 5; i++) {
      last = await H.api(base, 'POST', '/contact', {
        body: { name: `Spam Test ${i} ${Date.now()}`, email: `spam${i}@example.com`, message: 'This is a spam-protection test message.' },
      });
      if (last.status === 201) createdIds.push(last.json.data.id);
    }
    assert.equal(last.status, 429);
    // Cleanup: burahin ang mga na-insert bago ang 429 (ang name ay encrypted
    // kaya hindi pwedeng i-query — gamitin ang IDs mula sa responses)
    if (createdIds.length) {
      await H.supabase.from('contact_messages').delete().in('id', createdIds);
    }
  });
});
