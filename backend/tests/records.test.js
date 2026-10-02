// backend/tests/records.test.js
// Phase 5 — integration: doctor-written records (medical_records,
// lab_results, medications) — write+read, [ENC] fields (ciphertext-at-rest),
// at doctor-scoped read (ang doctor ay makakabasa lang ng pasyenteng may
// appointment sa kanya; ibang doctor → 404; patient role → 403).
// Kailangan ng backend/.env + Supabase; kung wala, naka-skip ang suite.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { manilaToday } from '../shared/utils/manilaTime.js';
import { hashPassword } from '../shared/utils/passwords.js';

let H = null;
let docs = [];
try {
  H = await import('./auth.helpers.js');
  const { data, error } = await H.supabase
    .from('doctor_weekly_availability')
    .select('doctor_id, weekday')
    .in('weekday', [1, 2, 3, 4, 5])
    .order('weekday', { ascending: true })
    .limit(40);
  if (error) throw error;
  const seen = new Map();
  // HUWAG huminto sa unang 2 doctors: i-scan lahat ng distinct doctors sa
  // rows at kunin ang unang 2 na WALANG account (ang unang mga rows ay
  // maaaring may seed/test account na — hal. kapag tumatakbo nang sabay
  // ang ibang suite na gumagawa ng throwaway doctor_accounts).
  for (const r of data || []) {
    if (!seen.has(r.doctor_id)) seen.set(r.doctor_id, r);
  }
  for (const [doctorId, row] of seen) {
    const existing = await H.supabase.from('doctor_accounts').select('id').eq('doctor_id', doctorId).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) docs.push({ doctorId, weekday: row.weekday });
    if (docs.length >= 2) break;
  }
  if (docs.length < 2) docs = [];
} catch {
  H = null;
  docs = [];
}

describe('records integration — Phase 5 doctor-written records', { skip: !H || docs.length < 2 }, () => {
  let base, server;
  const password = 'DocStr0ng1';
  const state = {};
  const emails = docs.map((_, i) => H.uniqueEmail(`phase5rec${i}`));

  const apiDoc = (idx, method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state[`docToken${idx}`] });
  const q = (pid) => `?patient_id=${encodeURIComponent(pid)}`;

  function targetDate(weekday) {
    const [y, m, d] = manilaToday().split('-').map(Number);
    const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    let delta = (weekday - isoDow + 7) % 7;
    if (delta === 0) delta = 7;
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
  }

  before(async () => {
    ({ base, server } = await H.bootApp());
    const password_hash = await hashPassword(password);
    for (let i = 0; i < 2; i++) {
      const ins = await H.supabase
        .from('doctor_accounts')
        .insert({ doctor_id: docs[i].doctorId, email: emails[i], password_hash })
        .select('id')
        .single();
      if (ins.error) throw new Error(`create doctor_accounts ${i}: ${ins.error.message}`);
      state[`docAccount${i}`] = ins.data.id;
      const login = await H.api(base, 'POST', '/auth/login', {
        body: { email: emails[i], password, role: 'doctor' },
      });
      assert.equal(login.status, 200, `doctor login ${i}`);
      state[`docToken${i}`] = login.json.data.accessToken;
    }
    // Patient + booking kay Doctor A (ito ang nagtatatag ng doctor-patient relation).
    const patientEmail = H.uniqueEmail('phase5recpat');
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Phase Five Records', email: patientEmail, phone: '+63 917 500 0002', password: 'Str0ngPass1' },
    });
    assert.equal(reg.status, 201);
    const login = await H.api(base, 'POST', '/auth/login', { body: { email: patientEmail, password: 'Str0ngPass1' } });
    assert.equal(login.status, 200);
    state.patientToken = login.json.data.accessToken;
    const me = await H.api(base, 'GET', '/patients/me', { token: state.patientToken });
    state.patientId = me.json.data.patient.id;
    state.date = targetDate(docs[0].weekday);

    const slots = await H.api(base, 'GET',
      `/appointments/slots?doctor_id=${docs[0].doctorId}&date=${state.date}&duration=30`,
      { token: state.patientToken });
    const free = (slots.json.data.slots || []).find((s) => s.is_available);
    assert.ok(free, 'may free slot para sa records test');
    const book = await H.api(base, 'POST', '/appointments', {
      token: state.patientToken,
      body: {
        doctor_id: docs[0].doctorId,
        appointment_date: state.date,
        start_time: free.start_time.slice(0, 5),
        reason: 'Para sa records test',
        contact_number: '+63 917 500 0002',
      },
    });
    assert.equal(book.status, 201);
  });

  after(async () => {
    try {
      if (H) {
        for (const key of ['docAccount0', 'docAccount1']) {
          if (state[key]) {
            await H.supabase.from('refresh_tokens').delete().eq('account_kind', 'doctor').eq('account_id', state[key]);
            await H.supabase.from('doctor_accounts').delete().eq('id', state[key]);
          }
        }
      }
    } catch { /* best-effort */ }
    try {
      if (server) server.close();
    } catch { /* ignore */ }
  });

  it('medical_records: POST → 201; ciphertext-at-rest; GET → decrypted', async () => {
    const c = await apiDoc(0, 'POST', '/records/medical', {
      body: {
        patient_id: state.patientId,
        visit_date: manilaToday(),
        record_type: 'Consultation',
        title: 'Hypertension follow-up',
        summary: 'BP 130/85. Continue maintenance meds.',
      },
    });
    assert.equal(c.status, 201);
    assert.equal(c.json.data.record.title, 'Hypertension follow-up');
    state.recordId = c.json.data.record.id;

    const raw = await H.supabase.from('medical_records').select('title, summary').eq('id', state.recordId).single();
    assert.ok(raw.data.title.startsWith('v1:'), 'title ay ciphertext sa DB');
    assert.ok(raw.data.summary.startsWith('v1:'), 'summary ay ciphertext sa DB');

    const g = await apiDoc(0, 'GET', `/records/medical${q(state.patientId)}`);
    assert.equal(g.status, 200);
    assert.ok((g.json.data.records || []).some((r) => r.id === state.recordId && r.summary === 'BP 130/85. Continue maintenance meds.'));
  });

  it('medical_records: PUT → 200 amended notes (sariling record lang)', async () => {
    const u = await apiDoc(0, 'PUT', `/records/medical/${state.recordId}`, {
      body: { summary: 'BP 128/82. Amended: reduce salt intake.' },
    });
    assert.equal(u.status, 200);
    assert.equal(u.json.data.record.summary, 'BP 128/82. Amended: reduce salt intake.');
    // Doctor B hindi makaka-amend ng record ni Doctor A → 404
    const u2 = await apiDoc(1, 'PUT', `/records/medical/${state.recordId}`, {
      body: { summary: 'Hindi dapat makapasok.' },
    });
    assert.equal(u2.status, 404);
  });

  it('lab_results: POST → 201; findings ay JSON string ng ciphertext; GET → array', async () => {
    const findings = [
      { item: 'Hemoglobin', value: '13.2', unit: 'g/dL', flag: null },
      { item: 'WBC', value: '11.5', unit: 'x10^9/L', range: '4.5–11.0', flag: 'high' },
    ];
    const c = await apiDoc(0, 'POST', '/records/lab', {
      body: {
        patient_id: state.patientId,
        test_name: 'Complete Blood Count',
        category: 'Hematology',
        result_date: manilaToday(),
        findings,
      },
    });
    assert.equal(c.status, 201);
    assert.deepEqual(c.json.data.lab_result.findings, findings);
    const labId = c.json.data.lab_result.id;

    const raw = await H.supabase.from('lab_results').select('test_name, findings').eq('id', labId).single();
    assert.ok(raw.data.test_name.startsWith('v1:'), 'test_name ay ciphertext sa DB');
    assert.equal(typeof raw.data.findings, 'string', 'findings ay JSON string sa jsonb column');
    // Tandaan: ang JSON string ay na-parse na pagka-read — ang value mismo ay
    // ang ciphertext na 'v1:...' (walang quote; ang quote ay JSON encoding lang).
    assert.ok(raw.data.findings.startsWith('v1:'), 'findings string ay ciphertext');

    const g = await apiDoc(0, 'GET', `/records/lab${q(state.patientId)}`);
    assert.equal(g.status, 200);
    const found = (g.json.data.lab_results || []).find((r) => r.id === labId);
    assert.ok(found);
    assert.deepEqual(found.findings, findings);
  });

  it('medications: POST → 201; [ENC] fields ay ciphertext; GET → decrypted', async () => {
    const c = await apiDoc(0, 'POST', '/records/medications', {
      body: {
        patient_id: state.patientId,
        name: 'Amlodipine',
        dose: '5mg',
        form: 'tablet',
        frequency: 'Once daily',
        instructions: 'Take after breakfast.',
      },
    });
    assert.equal(c.status, 201);
    assert.equal(c.json.data.medication.name, 'Amlodipine');
    const medId = c.json.data.medication.id;

    const raw = await H.supabase.from('medications').select('name, dose, instructions').eq('id', medId).single();
    assert.ok(raw.data.name.startsWith('v1:'), 'name ay ciphertext sa DB');
    assert.ok(raw.data.dose.startsWith('v1:'), 'dose ay ciphertext sa DB');
    assert.ok(raw.data.instructions.startsWith('v1:'), 'instructions ay ciphertext sa DB');

    const g = await apiDoc(0, 'GET', `/records/medications${q(state.patientId)}`);
    assert.equal(g.status, 200);
    const found = (g.json.data.medications || []).find((r) => r.id === medId);
    assert.ok(found && found.instructions === 'Take after breakfast.');
  });

  it('BOLA: Doctor B (walang relasyon sa patient) → 404 sa lahat ng reads/writes', async () => {
    const g1 = await apiDoc(1, 'GET', `/records/medical${q(state.patientId)}`);
    assert.equal(g1.status, 404);
    const g2 = await apiDoc(1, 'GET', `/records/lab${q(state.patientId)}`);
    assert.equal(g2.status, 404);
    const c1 = await apiDoc(1, 'POST', '/records/medical', {
      body: {
        patient_id: state.patientId,
        visit_date: manilaToday(),
        record_type: 'Consultation',
        title: 'Hindi dapat makapasok',
        summary: 'Sapat na haba ng summary para sa test.',
      },
    });
    assert.equal(c1.status, 404);
  });

  it('patient role → 403 sa records endpoints (doctor-only)', async () => {
    const r = await H.api(base, 'GET', `/records/medical${q(state.patientId)}`, { token: state.patientToken });
    assert.equal(r.status, 403);
  });

  it('validation: future visit_date → 400; bad patient_id → 400', async () => {
    const bad = await apiDoc(0, 'POST', '/records/medical', {
      body: {
        patient_id: state.patientId,
        visit_date: '2099-01-01',
        record_type: 'Consultation',
        title: 'Future',
        summary: 'Sapat na haba ng summary para sa test.',
      },
    });
    assert.equal(bad.status, 400);
    const bad2 = await apiDoc(0, 'GET', '/records/medical?patient_id=nope');
    assert.equal(bad2.status, 400);
  });
});
