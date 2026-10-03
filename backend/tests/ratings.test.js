// backend/tests/ratings.test.js
// Phase 5 — integration: doctor feedback view (GET /api/ratings/doctor) —
// visit_ratings ng sariling visits + average/count mula sa
// v_doctor_rating_averages. (Ang patient submission flow ay naka-cover sa
// appointments.test.js.)
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

describe('ratings integration — Phase 5 doctor feedback view', { skip: !H || docs.length < 2 }, () => {
  let base, server;
  const password = 'DocStr0ng1';
  const state = {};

  const apiDoc = (idx, method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state[`docToken${idx}`] });

  function targetDate(weekday) {
    const [y, m, d] = manilaToday().split('-').map(Number);
    const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    let delta = (weekday - isoDow + 7) % 7;
    if (delta === 0) delta = 7;
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
  }

  /**
   * Humanap ng doctor na may weekday availability at WALANG doctor_account pa,
   * hindi kasama ang mga doctor_id sa `exclude`.
   */
  async function findDoctorWithoutAccount(exclude) {
    const { data, error } = await H.supabase
      .from('doctor_weekly_availability')
      .select('doctor_id, weekday')
      .in('weekday', [1, 2, 3, 4, 5])
      .order('weekday', { ascending: true })
      .limit(60);
    if (error) throw error;
    const seen = new Map();
    for (const r of data || []) if (!seen.has(r.doctor_id)) seen.set(r.doctor_id, r);
    for (const [doctorId, row] of seen) {
      if (exclude.has(doctorId)) continue;
      const existing = await H.supabase
        .from('doctor_accounts').select('id').eq('doctor_id', doctorId).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) return { doctorId, weekday: row.weekday };
    }
    return null;
  }

  /**
   * Gumawa ng doctor_account para kay docs[i]. 23505-tolerant: kapag ang
   * doctor ay nabigyan na ng account ng ibang sabay-tumatakbong suite,
   * papalitan ang docs[i] ng ibang doctor na walang account pa at uulitin.
   */
  async function acquireAccount(password_hash, i, emailPrefix) {
    for (;;) {
      const email = H.uniqueEmail(`${emailPrefix}${i}`);
      const ins = await H.supabase
        .from('doctor_accounts')
        .insert({ doctor_id: docs[i].doctorId, email, password_hash })
        .select('id')
        .single();
      if (!ins.error) return { accountId: ins.data.id, email };
      if (ins.error.code !== '23505') {
        throw new Error(`create doctor_accounts ${i}: ${ins.error.message}`);
      }
      const replacement = await findDoctorWithoutAccount(new Set(docs.map((d) => d.doctorId)));
      if (!replacement) throw new Error('walang available na doctor para sa test');
      docs[i] = replacement;
    }
  }

  before(async () => {
    ({ base, server } = await H.bootApp());
    const password_hash = await hashPassword(password);
    for (let i = 0; i < 2; i++) {
      const { accountId, email } = await acquireAccount(password_hash, i, 'phase5rate');
      state[`docAccount${i}`] = accountId;
      const login = await H.api(base, 'POST', '/auth/login', {
        body: { email, password, role: 'doctor' },
      });
      assert.equal(login.status, 200, `doctor login ${i}`);
      state[`docToken${i}`] = login.json.data.accessToken;
    }
    // Patient + booking kay Doctor A → complete → rate (gumagawa ng rating row).
    const patientEmail = H.uniqueEmail('phase5ratepat');
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Phase Five Rater', email: patientEmail, phone: '+63 917 500 0003', password: 'Str0ngPass1' },
    });
    assert.equal(reg.status, 201);
    const login = await H.api(base, 'POST', '/auth/login', { body: { email: patientEmail, password: 'Str0ngPass1' } });
    assert.equal(login.status, 200);
    state.patientToken = login.json.data.accessToken;
    state.date = targetDate(docs[0].weekday);

    const slots = await H.api(base, 'GET',
      `/appointments/slots?doctor_id=${docs[0].doctorId}&date=${state.date}&duration=30`,
      { token: state.patientToken });
    const free = (slots.json.data.slots || []).find((s) => s.is_available);
    assert.ok(free, 'may free slot para sa ratings test');
    const book = await H.api(base, 'POST', '/appointments', {
      token: state.patientToken,
      body: {
        doctor_id: docs[0].doctorId,
        appointment_date: state.date,
        start_time: free.start_time.slice(0, 5),
        reason: 'Para sa ratings test',
        contact_number: '+63 917 500 0003',
      },
    });
    assert.equal(book.status, 201);
    const apptId = book.json.data.appointment.id;

    const done = await apiDoc(0, 'POST', `/doctor/appointments/${apptId}/complete`, {
      body: { notes: 'Routine check-up. All vitals normal today.' },
    });
    assert.equal(done.status, 201, 'complete visit bago mag-rate');

    const rate = await H.api(base, 'POST', '/ratings', {
      token: state.patientToken,
      body: { appointment_id: apptId, stars: 5, comment: 'Magaling na doktor!' },
    });
    assert.equal(rate.status, 201, 'patient rating submitted');
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

  it('GET /ratings/doctor → 200: sariling ratings + average/count', async () => {
    const r = await apiDoc(0, 'GET', '/ratings/doctor');
    assert.equal(r.status, 200);
    const { ratings, avg_rating, rating_count } = r.json.data;
    assert.ok(Array.isArray(ratings));
    const mine = ratings.find((x) => x.stars === 5 && x.comment === 'Magaling na doktor!');
    assert.ok(mine, 'nakikita ng doctor ang rating ng sariling visit');
    assert.ok(mine.patient_name, 'may patient name (hindi patient_id leak)');
    assert.ok(Number(rating_count) >= 1, 'rating_count ≥ 1');
    assert.ok(Number(avg_rating) >= 1 && Number(avg_rating) <= 5, 'avg_rating nasa 1–5');
  });

  it('BOLA: Doctor B hindi nakikita ang ratings ni Doctor A', async () => {
    const r = await apiDoc(1, 'GET', '/ratings/doctor');
    assert.equal(r.status, 200);
    const { ratings } = r.json.data;
    assert.ok(!(ratings || []).some((x) => x.comment === 'Magaling na doktor!'));
  });

  it('patient role → 403 sa doctor feedback endpoint', async () => {
    const r = await H.api(base, 'GET', '/ratings/doctor', { token: state.patientToken });
    assert.equal(r.status, 403);
  });

  it('walang token → 401', async () => {
    const r = await H.api(base, 'GET', '/ratings/doctor');
    assert.equal(r.status, 401);
  });
});
