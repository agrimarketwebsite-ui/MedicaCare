// backend/tests/doctors.test.js
// Phase 5 — integration: doctor portal (own profile, weekly availability
// CRUD, today/week schedule, complete visit → medical_records, no-show frees
// slot, BOLA Doctor B → 404, [ENC] ciphertext-at-rest).
// Kailangan ng backend/.env + Supabase; kung wala, naka-skip ang suite
// (hindi failure). TANDAAN: ang bawat test FILE ay sariling process
// (sariling rate-limiter memory).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { manilaToday } from '../shared/utils/manilaTime.js';
import { hashPassword } from '../shared/utils/passwords.js';

let H = null;
let docs = []; // ≥2 doctors na may weekday availability (Mon–Fri)
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
  // Ang doctor ay dapat WALANG doctor_accounts row pa (unique doctor_id).
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

describe('doctors integration — Phase 5 doctor portal', { skip: !H || docs.length < 2 }, () => {
  let base, server;
  const password = 'DocStr0ng1';
  const state = {}; // tokens, ids

  const apiDoc = (idx, method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state[`docToken${idx}`] });

  /** Susunod na petsa (Manila) na tugma sa availability weekday — laging future. */
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
   * doctor ay nabigyan na ng account ng ibang sabay-tumatakbong suite
   * (node --test = parallel files), papalitan ang docs[i] ng ibang doctor
   * na walang account pa at uulitin — hanggang magtagumpay.
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
      const { accountId, email } = await acquireAccount(password_hash, i, 'phase5doc');
      state[`docAccount${i}`] = accountId;
      const login = await H.api(base, 'POST', '/auth/login', {
        body: { email, password, role: 'doctor' },
      });
      assert.equal(login.status, 200, `doctor login ${i}`);
      assert.equal(login.json.data.role, 'doctor');
      state[`docToken${i}`] = login.json.data.accessToken;
    }
    // Patient account para sa booking flows (complete/no-show tests).
    const patientEmail = H.uniqueEmail('phase5pat');
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: { full_name: 'Phase Five Patient', email: patientEmail, phone: '+63 917 500 0001', password: 'Str0ngPass1' },
    });
    assert.equal(reg.status, 201);
    const login = await H.api(base, 'POST', '/auth/login', {
      body: { email: patientEmail, password: 'Str0ngPass1' },
    });
    assert.equal(login.status, 200, 'patient login');
    state.patientToken = login.json.data.accessToken;
    const me = await H.api(base, 'GET', '/patients/me', { token: state.patientToken });
    state.patientId = me.json.data.patient.id;
    state.date = targetDate(docs[0].weekday);
  });

  after(async () => {
    try {
      if (H && state.docAccount0) {
        for (const key of ['docAccount0', 'docAccount1']) {
          if (state[key]) {
            await H.supabase.from('refresh_tokens').delete().eq('account_kind', 'doctor').eq('account_id', state[key]);
            await H.supabase.from('doctor_accounts').delete().eq('id', state[key]);
          }
        }
      }
    } catch { /* best-effort cleanup */ }
    try {
      if (server) server.close();
    } catch { /* ignore */ }
  });

  it('GET /doctors/me/profile → 200 sariling doctor (+ rating fields)', async () => {
    const r = await apiDoc(0, 'GET', '/doctors/me/profile');
    assert.equal(r.status, 200);
    assert.equal(r.json.data.doctor.id, docs[0].doctorId);
    assert.ok('avg_rating' in r.json.data.doctor);
  });

  it('patient role ay hindi makakapasok sa doctor endpoints → 403', async () => {
    const r = await H.api(base, 'GET', '/doctors/me/profile', { token: state.patientToken });
    assert.equal(r.status, 403);
  });

  it('availability CRUD: POST → 201; duplicate → 409; PUT → 200; DELETE → 204', async () => {
    const payload = { weekday: 6, start_time: '09:00', end_time: '11:00' };
    const c1 = await apiDoc(0, 'POST', '/doctors/me/availability', { body: payload });
    assert.equal(c1.status, 201, 'create availability');
    const entryId = c1.json.data.entry.id;
    const c2 = await apiDoc(0, 'POST', '/doctors/me/availability', { body: payload });
    assert.equal(c2.status, 409, 'duplicate → 409');
    const bad = await apiDoc(0, 'POST', '/doctors/me/availability', {
      body: { weekday: 6, start_time: '14:00', end_time: '12:00' },
    });
    assert.equal(bad.status, 400, 'end < start → 400');
    const u1 = await apiDoc(0, 'PUT', `/doctors/me/availability/${entryId}`, { body: { end_time: '12:00' } });
    assert.equal(u1.status, 200, 'update');
    assert.equal(u1.json.data.entry.end_time.slice(0, 5), '12:00');
    // Doctor B hindi makaka-update ng entry ni Doctor A → 404
    const u2 = await apiDoc(1, 'PUT', `/doctors/me/availability/${entryId}`, { body: { end_time: '13:00' } });
    assert.equal(u2.status, 404, 'cross-doctor update → 404');
    const d1 = await apiDoc(0, 'DELETE', `/doctors/me/availability/${entryId}`);
    assert.equal(d1.status, 204, 'delete');
    const list = await apiDoc(0, 'GET', '/doctors/me/availability');
    assert.equal(list.status, 200);
    assert.ok(!(list.json.data.availability || []).some((e) => e.id === entryId));
  });

  it('GET /doctor/appointments/today at /week → 200 tamang shape', async () => {
    const t = await apiDoc(0, 'GET', '/doctor/appointments/today');
    assert.equal(t.status, 200);
    assert.equal(t.json.data.date, manilaToday());
    assert.ok(Array.isArray(t.json.data.appointments));
    const w = await apiDoc(0, 'GET', '/doctor/appointments/week');
    assert.equal(w.status, 200);
    assert.ok(w.json.data.week_start <= w.json.data.week_end);
    assert.ok(Array.isArray(w.json.data.appointments));
  });

  it('complete visit: pending → completed + medical_records row; ulit → 409', async () => {
    // Mag-book bilang patient para kay Doctor A.
    const slots = await H.api(base, 'GET',
      `/appointments/slots?doctor_id=${docs[0].doctorId}&date=${state.date}&duration=30`,
      { token: state.patientToken });
    assert.equal(slots.status, 200);
    const free = (slots.json.data.slots || []).find((s) => s.is_available);
    assert.ok(free, 'may free slot para sa test');
    const book = await H.api(base, 'POST', '/appointments', {
      token: state.patientToken,
      body: {
        doctor_id: docs[0].doctorId,
        appointment_date: state.date,
        start_time: free.start_time.slice(0, 5),
        reason: 'Ubo at sipon ng ilang araw',
        contact_number: '+63 917 500 0001',
      },
    });
    assert.equal(book.status, 201, 'book para kay Doctor A');
    const apptId = book.json.data.appointment.id;
    state.apptComplete = apptId;

    const notes = 'Upper respiratory tract infection. Prescribed rest and fluids for one week.';
    const done = await apiDoc(0, 'POST', `/doctor/appointments/${apptId}/complete`, { body: { notes } });
    assert.equal(done.status, 201, 'complete visit');
    assert.equal(done.json.data.appointment.status, 'completed');
    assert.equal(done.json.data.appointment.notes, notes, 'notes decrypted para sa doctor');
    assert.ok(done.json.data.medical_record, 'may medical_records row');
    assert.equal(done.json.data.medical_record.record_type, 'Consultation');

    // Ciphertext-at-rest: ang notes at record fields ay v1: sa DB.
    const rawAppt = await H.supabase.from('appointments').select('notes').eq('id', apptId).single();
    assert.ok(rawAppt.data.notes.startsWith('v1:'), 'appointments.notes ay ciphertext sa DB');
    const rawRec = await H.supabase
      .from('medical_records')
      .select('title, summary')
      .eq('appointment_id', apptId)
      .single();
    assert.ok(rawRec.data.title.startsWith('v1:'), 'medical_records.title ay ciphertext');
    assert.ok(rawRec.data.summary.startsWith('v1:'), 'medical_records.summary ay ciphertext');

    const again = await apiDoc(0, 'POST', `/doctor/appointments/${apptId}/complete`, { body: { notes } });
    assert.equal(again.status, 409, 'complete ulit → 409');
    const noShow = await apiDoc(0, 'POST', `/doctor/appointments/${apptId}/no-show`);
    assert.equal(noShow.status, 409, 'no-show sa completed → 409');
  });

  it('BOLA: Doctor B hindi makakabasa/makaka-complete ng appointment ni Doctor A → 404', async () => {
    const g = await apiDoc(1, 'GET', `/doctor/appointments/${state.apptComplete}`);
    assert.equal(g.status, 404);
    const c = await apiDoc(1, 'POST', `/doctor/appointments/${state.apptComplete}/complete`, {
      body: { notes: 'Sapat na haba ng notes para sa test.' },
    });
    assert.equal(c.status, 404);
  });

  it('no-show: pending → no-show; ang slot ay napapalaya (pwedeng i-book ulit)', async () => {
    const slots = await H.api(base, 'GET',
      `/appointments/slots?doctor_id=${docs[0].doctorId}&date=${state.date}&duration=30`,
      { token: state.patientToken });
    const free = (slots.json.data.slots || []).find((s) => s.is_available);
    assert.ok(free, 'may free slot para sa no-show test');
    const book = await H.api(base, 'POST', '/appointments', {
      token: state.patientToken,
      body: {
        doctor_id: docs[0].doctorId,
        appointment_date: state.date,
        start_time: free.start_time.slice(0, 5),
        reason: 'Masakit ang likod at balakang',
        contact_number: '+63 917 500 0001',
      },
    });
    assert.equal(book.status, 201);
    const apptId = book.json.data.appointment.id;
    const slotStart = free.start_time.slice(0, 5);

    const ns = await apiDoc(0, 'POST', `/doctor/appointments/${apptId}/no-show`);
    assert.equal(ns.status, 200, 'no-show');
    assert.equal(ns.json.data.appointment.status, 'no-show');

    // Ang slot ay napalaya: ang parehong slot ay pwedeng i-book ulit (ang
    // uq_appointments_active_slot ay pending/confirmed lang).
    const rebook = await H.api(base, 'POST', '/appointments', {
      token: state.patientToken,
      body: {
        doctor_id: docs[0].doctorId,
        appointment_date: state.date,
        start_time: slotStart,
        reason: 'Rebook matapos ang no-show',
        contact_number: '+63 917 500 0001',
      },
    });
    assert.equal(rebook.status, 201, 'ang no-show slot ay pwedeng i-book ulit');
  });

  it('GET /doctor/appointments/:id → 200 detail (decrypted, may patient + history)', async () => {
    const r = await apiDoc(0, 'GET', `/doctor/appointments/${state.apptComplete}`);
    assert.equal(r.status, 200);
    const appt = r.json.data.appointment;
    assert.equal(appt.status, 'completed');
    assert.ok(appt.patient && appt.patient.full_name, 'may patient info');
    assert.ok(Array.isArray(appt.status_history), 'may status history');
    assert.ok(appt.medical_record, 'may linked medical record');
  });
});
