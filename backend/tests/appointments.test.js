// backend/tests/appointments.test.js
// Phase 4 — integration: patient portal core (profile, family, slots,
// booking, slot race, BOLA, reschedule, cancel, ratings).
// Kailangan ng backend/.env + Supabase (na-apply ang migration 004);
// kung wala, naka-skip ang suite (hindi failure).
// TANDAAN: ang bawat test FILE ay sariling process (sariling rate-limiter
// memory) — ang file na ito ay nananatili sa ≤10 authLimiter hits
// (2 register + 2 login lang).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { manilaToday } from '../shared/utils/manilaTime.js';

let H = null;
let avail = null; // { doctor_id, weekday } — may weekly availability (Mon–Fri)
try {
  H = await import('./auth.helpers.js');
  const { data, error } = await H.supabase
    .from('doctor_weekly_availability')
    .select('doctor_id, weekday, start_time, end_time')
    .in('weekday', [1, 2, 3, 4, 5])
    .order('weekday', { ascending: true })
    .limit(20);
  if (error) throw error;
  avail = data && data.length ? data[0] : null;
} catch {
  H = null;
  avail = null;
}

describe('appointments integration — Phase 4 patient portal core', { skip: !H || !avail }, () => {
  let base, server;
  const password = 'Str0ngPass1';
  const emailA = H ? H.uniqueEmail('phase4a') : '';
  const emailB = H ? H.uniqueEmail('phase4b') : '';
  const phoneA = '+63 917 400 0001';
  const phoneB = '+63 917 400 0002';
  const doctorId = avail ? avail.doctor_id : null;
  const REASON_A = 'Masakit ang ulo at may lagnat';
  const CONTACT_A = '+63 917 111 2233';
  const state = {}; // tokens, ids, slots

  const apiA = (method, path, opts) => H.api(base, method, path, { ...opts, token: state.tokenA });
  const apiB = (method, path, opts) => H.api(base, method, path, { ...opts, token: state.tokenB });

  /** Susunod na petsa (Manila) na tugma sa availability weekday — laging future. */
  function targetDate() {
    const [y, m, d] = manilaToday().split('-').map(Number);
    const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
    const isoDow = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun (tugma sa isodow ng fn)
    let delta = (avail.weekday - isoDow + 7) % 7;
    if (delta === 0) delta = 7; // strictly future — iwas same-day time rule
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
  }

  const bookingBody = (slotHHMM, extra = {}) => ({
    doctor_id: doctorId,
    appointment_date: state.date,
    start_time: slotHHMM,
    reason: REASON_A,
    contact_number: CONTACT_A,
    ...extra,
  });

  before(async () => {
    ({ base, server } = await H.bootApp());
    for (const [email, phone, key] of [[emailA, phoneA, 'A'], [emailB, phoneB, 'B']]) {
      const reg = await H.api(base, 'POST', '/auth/register', {
        body: { full_name: `Phase Four ${key}`, email, phone, password },
      });
      assert.equal(reg.status, 201, `register ${key}`);
      const login = await H.api(base, 'POST', '/auth/login', { body: { email, password } });
      assert.equal(login.status, 200, `login ${key}`);
      state[`token${key}`] = login.json.data.accessToken;
      const me = await H.api(base, 'GET', '/patients/me', { token: login.json.data.accessToken });
      assert.equal(me.status, 200, `GET /patients/me ${key}`);
      state[`patient${key}Id`] = me.json.data.patient.id;
    }
    state.date = targetDate();
  });

  after(async () => {
    server?.close();
    if (H) {
      // Ang pag-delete ng patient ay nagka-cascade sa appointments, family,
      // at ratings (FK on delete cascade).
      await H.cleanupAccount(emailA).catch(() => {});
      await H.cleanupAccount(emailB).catch(() => {});
    }
  });

  it('GET /appointments/slots nang walang token → 401', async () => {
    const r = await H.api(base, 'GET', `/appointments/slots?doctor_id=${doctorId}&date=${state.date}&duration=30`);
    assert.equal(r.status, 401);
  });

  it('slots: bad doctor_id → 400; past date → 400', async () => {
    const bad = await apiA('GET', `/appointments/slots?doctor_id=nope&date=${state.date}`);
    assert.equal(bad.status, 400);
    const past = await apiA('GET', `/appointments/slots?doctor_id=${doctorId}&date=2020-01-01`);
    assert.equal(past.status, 400);
  });

  it('slots: 200 + tamang shape; ≥6 free slots para sa test flow', async () => {
    const r = await apiA('GET', `/appointments/slots?doctor_id=${doctorId}&date=${state.date}&duration=30`);
    assert.equal(r.status, 200);
    const slots = r.json.data.slots;
    assert.ok(Array.isArray(slots) && slots.length > 0, 'may slots sa availability day');
    for (const s of slots) {
      assert.match(s.start_time, /^\d{2}:\d{2}:\d{2}$/);
      assert.match(s.end_time, /^\d{2}:\d{2}:\d{2}$/);
      assert.equal(typeof s.is_available, 'boolean');
    }
    state.freeSlots = slots.filter((s) => s.is_available).map((s) => s.start_time.slice(0, 5));
    assert.ok(state.freeSlots.length >= 6, `kailangan ng ≥6 free slots (nakuha: ${state.freeSlots.length})`);
    [state.slotA1, state.raceSlot, state.slotB1, state.slotProxy, state.slotBadProxy, state.slotFree] =
      state.freeSlots;
  });

  it('profile: GET /patients/me → 200, decrypted, walang password_hash', async () => {
    const r = await apiA('GET', '/patients/me');
    assert.equal(r.status, 200);
    assert.equal(r.json.data.patient.email, emailA);
    assert.ok(!('password_hash' in r.json.data.patient));
  });

  it('profile: PUT [ENC] fields → 200 decrypted; DB column ay ciphertext', async () => {
    const r = await apiA('PUT', '/patients/me', {
      body: {
        date_of_birth: '1990-05-05',
        blood_type: 'O+',
        allergies: 'Penicillin',
        address: '123 Test St',
        email_reminders: false,
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.patient.allergies, 'Penicillin');
    assert.equal(r.json.data.patient.date_of_birth, '1990-05-05');
    assert.equal(r.json.data.patient.email_reminders, false);
    // Ciphertext at rest (hindi plaintext sa DB):
    const { data, error } = await H.supabase
      .from('patients')
      .select('date_of_birth, blood_type, allergies, address')
      .eq('id', state.patientAId)
      .single();
    assert.ok(!error);
    for (const [k, v] of Object.entries(data)) {
      assert.ok(v.startsWith('v1:'), `${k} ay naka-encrypt sa DB`);
      assert.ok(!v.includes('Penicillin') && !v.includes('1990-05-05'), `${k} walang plaintext leak`);
    }
  });

  it('profile: email ay hindi updatable (.strict() → 400); future dob → 400', async () => {
    const r1 = await apiA('PUT', '/patients/me', { body: { email: 'new@example.com' } });
    assert.equal(r1.status, 400);
    const r2 = await apiA('PUT', '/patients/me', { body: { date_of_birth: '2999-01-01' } });
    assert.equal(r2.status, 400);
  });

  it('family: POST → 201; GET list; PUT → 200; cross-patient → 404; DELETE → 204', async () => {
    const c = await apiA('POST', '/patients/me/family', {
      body: { full_name: 'Maria Test', relation: 'Mother', age: 60 },
    });
    assert.equal(c.status, 201);
    const memberId = c.json.data.member.id;
    assert.equal(c.json.data.member.full_name, 'Maria Test'); // decrypted para sa owner
    // Ciphertext at rest:
    const dbRow = await H.supabase.from('patient_family_members').select('full_name, relation').eq('id', memberId).single();
    assert.ok(dbRow.data.full_name.startsWith('v1:'));
    assert.ok(dbRow.data.relation.startsWith('v1:'));

    const list = await apiA('GET', '/patients/me/family');
    assert.equal(list.status, 200);
    assert.ok(list.json.data.family.some((m) => m.id === memberId));

    const upd = await apiA('PUT', `/patients/me/family/${memberId}`, { body: { relation: 'Ina' } });
    assert.equal(upd.status, 200);
    assert.equal(upd.json.data.member.relation, 'Ina');

    // BOLA: hindi pag-aari ni B → 404 (hindi 403)
    assert.equal((await apiB('PUT', `/patients/me/family/${memberId}`, { body: { relation: 'X' } })).status, 404);
    assert.equal((await apiB('DELETE', `/patients/me/family/${memberId}`)).status, 404);

    assert.equal((await apiA('DELETE', `/patients/me/family/${memberId}`)).status, 204);
    const gone = await H.supabase.from('patient_family_members').select('id').eq('id', memberId).maybeSingle();
    assert.equal(gone.data, null);
  });

  it('book: POST → 201 + reference_code (AP-000123 style) + decrypted confirmation', async () => {
    const r = await apiA('POST', '/appointments', { body: bookingBody(state.slotA1) });
    assert.equal(r.status, 201);
    const appt = r.json.data.appointment;
    assert.match(appt.reference_code, /^AP-\d{6}$/);
    assert.ok(['pending', 'confirmed'].includes(appt.status), `status=${appt.status}`);
    assert.equal(appt.reason, REASON_A); // decrypted para sa owner
    assert.equal(appt.contact_number, CONTACT_A);
    assert.equal(appt.doctor.id, doctorId);
    state.apptA1 = appt.id;
  });

  it('book: DB stores ciphertext para sa reason (walang plaintext)', async () => {
    const { data, error } = await H.supabase
      .from('appointments')
      .select('reason, contact_number')
      .eq('id', state.apptA1)
      .single();
    assert.ok(!error);
    assert.ok(data.reason.startsWith('v1:'), 'reason ay ciphertext sa DB');
    assert.ok(!data.reason.includes('lagnat'), 'walang plaintext leak sa reason');
    assert.ok(data.contact_number.startsWith('v1:'), 'contact_number ay ciphertext sa DB');
  });

  it('book: parehong slot ni B → 409', async () => {
    const r = await apiB('POST', '/appointments', { body: bookingBody(state.slotA1) });
    assert.equal(r.status, 409);
  });

  it('RACE: dalawang sabay na POST sa iisang bagong slot → eksaktong isang 201 + isang 409 (never 500)', async () => {
    const [rA, rB] = await Promise.all([
      apiA('POST', '/appointments', { body: bookingBody(state.raceSlot) }),
      apiB('POST', '/appointments', { body: bookingBody(state.raceSlot) }),
    ]);
    const statuses = [rA.status, rB.status].sort();
    assert.deepEqual(statuses, [201, 409], `race statuses: ${rA.status}, ${rB.status}`);
    state.raceWinner = rA.status === 201 ? 'A' : 'B';
  });

  it('book: B sa ibang free slot → 201 (pang-BOLA tests)', async () => {
    const r = await apiB('POST', '/appointments', { body: bookingBody(state.slotB1) });
    assert.equal(r.status, 201);
    state.apptB1 = r.json.data.appointment.id;
  });

  it('proxy booking: family_member_id → booked_for = family name; ibang patient → 404', async () => {
    const fm = await apiA('POST', '/patients/me/family', { body: { full_name: 'Jose Proxy', relation: 'Father' } });
    assert.equal(fm.status, 201);
    const famId = fm.json.data.member.id;
    const r = await apiA('POST', '/appointments', { body: bookingBody(state.slotProxy, { family_member_id: famId }) });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.appointment.booked_for, 'Jose Proxy');
    state.apptA2 = r.json.data.appointment.id;
    // Ang family member ni A ay hindi magagamit ni B → 404
    const bad = await apiB('POST', '/appointments', { body: bookingBody(state.slotBadProxy, { family_member_id: famId }) });
    assert.equal(bad.status, 404);
  });

  it('list: A nakikita lang ang sariling appointments (BOLA)', async () => {
    const r = await apiA('GET', '/appointments');
    assert.equal(r.status, 200);
    const ids = r.json.data.appointments.map((a) => a.id);
    assert.ok(ids.includes(state.apptA1), 'sariling appointment kasama');
    assert.ok(!ids.includes(state.apptB1), 'appointment ni B hindi kasama');
    const one = r.json.data.appointments.find((a) => a.id === state.apptA1);
    assert.equal(one.doctor.id, doctorId);
    assert.ok(one.doctor.specialty_name, 'may specialty_name mula sa join');
    assert.equal(one.reason, REASON_A, 'reason decrypted sa list');
    assert.ok(!('additional_notes' in one), 'walang additional_notes sa list');
    assert.ok(!('contact_number' in one), 'walang contact_number sa list');
    // status filter: walang cancelled si A sa puntong ito → empty; bad status → 400
    const f = await apiA('GET', '/appointments?status=cancelled');
    assert.equal(f.status, 200);
    assert.deepEqual(f.json.data.appointments, []);
    assert.equal((await apiA('GET', '/appointments?status=sleeping')).status, 400);
  });

  it('detail: decrypted [ENC] + status_history timeline (trigger-written)', async () => {
    const r = await apiA('GET', `/appointments/${state.apptA1}`);
    assert.equal(r.status, 200);
    const appt = r.json.data.appointment;
    assert.equal(appt.reason, REASON_A);
    assert.equal(appt.contact_number, CONTACT_A);
    assert.ok(Array.isArray(appt.status_history) && appt.status_history.length >= 1, 'may timeline');
    assert.equal(appt.status_history[0].to_status, appt.status, 'unang history = initial status');
  });

  it('BOLA: A hindi makakabasa/makaka-cancel ng appointment ni B → 404', async () => {
    assert.equal((await apiA('GET', `/appointments/${state.apptB1}`)).status, 404);
    assert.equal((await apiA('POST', `/appointments/${state.apptB1}/cancel`)).status, 404);
  });

  it('reschedule: taken slot → 409; sariling slot → 200; free slot → 200', async () => {
    const taken = await apiA('POST', `/appointments/${state.apptA1}/reschedule`, {
      body: { appointment_date: state.date, start_time: state.raceSlot },
    });
    assert.equal(taken.status, 409, 'taken ng race winner');
    // Sariling kasalukuyang slot ay nananatiling selectable (p_exclude_appt_id):
    const same = await apiA('POST', `/appointments/${state.apptA1}/reschedule`, {
      body: { appointment_date: state.date, start_time: state.slotA1 },
    });
    assert.equal(same.status, 200);
    const free = await apiA('POST', `/appointments/${state.apptA1}/reschedule`, {
      body: { appointment_date: state.date, start_time: state.slotFree },
    });
    assert.equal(free.status, 200);
    assert.equal(free.json.data.appointment.start_time.slice(0, 5), state.slotFree);
  });

  it('reschedule: bad id → 400; appointment ni B → 404', async () => {
    assert.equal((await apiA('POST', '/appointments/nope/reschedule', { body: { appointment_date: state.date, start_time: state.slotA1 } })).status, 400);
    assert.equal((await apiA('POST', `/appointments/${state.apptB1}/reschedule`, { body: { appointment_date: state.date, start_time: state.slotA1 } })).status, 404);
  });

  it('cancel: 200 cancelled; ulit → 409', async () => {
    const r = await apiA('POST', `/appointments/${state.apptA1}/cancel`);
    assert.equal(r.status, 200);
    assert.equal(r.json.data.appointment.status, 'cancelled');
    assert.equal((await apiA('POST', `/appointments/${state.apptA1}/cancel`)).status, 409);
  });

  it('ratings: completed → 201; ulit → 409; hindi-completed → 409; ibang patient → 404', async () => {
    // Completed appointment (direct insert — ang doctor "complete visit" ay Phase 5)
    const { data: comp, error } = await H.supabase
      .from('appointments')
      .insert({
        patient_id: state.patientAId,
        doctor_id: doctorId,
        appointment_date: state.date,
        start_time: '07:00:00',
        end_time: '07:30:00',
        reason: 'v1:seed',
        contact_number: 'v1:seed',
        status: 'completed',
      })
      .select('id')
      .single();
    assert.ok(!error, `insert completed: ${error?.message}`);

    const r1 = await apiA('POST', '/ratings', { body: { appointment_id: comp.id, stars: 5, comment: 'Magaling!' } });
    assert.equal(r1.status, 201);
    assert.equal(r1.json.data.rating.stars, 5);

    // rated flag: pagkatapos ma-rate, ang detail + list DTO ay rated=true
    // (ito ang ginagamit ng UI para itago ang "Rate your visit"); ang hindi
    // pa na-rate (apptA2) ay rated=false.
    const det = await apiA('GET', `/appointments/${comp.id}`);
    assert.equal(det.status, 200);
    assert.equal(det.json.data.appointment.rated, true, 'detail: rated=true pagkatapos mag-rate');
    const lst = await apiA('GET', '/appointments');
    assert.equal(lst.status, 200);
    assert.equal(lst.json.data.appointments.find((a) => a.id === comp.id)?.rated, true, 'list: rated=true');
    assert.equal(lst.json.data.appointments.find((a) => a.id === state.apptA2)?.rated, false, 'list: unrated → false');

    const r2 = await apiA('POST', '/ratings', { body: { appointment_id: comp.id, stars: 4 } });
    assert.equal(r2.status, 409, 'one-rating-per-appointment');

    // Hindi completed (apptA2 = pending/confirmed) → 409
    const r3 = await apiA('POST', '/ratings', { body: { appointment_id: state.apptA2, stars: 5 } });
    assert.equal(r3.status, 409);

    // Completed appointment ni B — si A ay 404 (hindi 403)
    const { data: compB } = await H.supabase
      .from('appointments')
      .insert({
        patient_id: state.patientBId,
        doctor_id: doctorId,
        appointment_date: state.date,
        start_time: '07:30:00',
        end_time: '08:00:00',
        reason: 'v1:seed',
        contact_number: 'v1:seed',
        status: 'completed',
      })
      .select('id')
      .single();
    assert.equal((await apiA('POST', '/ratings', { body: { appointment_id: compB.id, stars: 5 } })).status, 404);
    // …pero si B mismo ay 201
    assert.equal((await apiB('POST', '/ratings', { body: { appointment_id: compB.id, stars: 4 } })).status, 201);
  });

  it('attendee overlap: ibang doctor parehong oras (self) → 409; family member → 201; adjacent → 201', async () => {
    // Pangalawang doctor na may availability sa parehong weekday (parehong petsa)
    const { data: av2, error: avErr } = await H.supabase
      .from('doctor_weekly_availability')
      .select('doctor_id')
      .eq('weekday', avail.weekday)
      .neq('doctor_id', doctorId)
      .limit(1);
    assert.ok(!avErr && av2?.length, 'may pangalawang doctor sa parehong weekday');
    const doctor2 = av2[0].doctor_id;

    const slotsOf = async (doc) => {
      const r = await apiA('GET', `/appointments/slots?doctor_id=${doc}&date=${state.date}&duration=30`);
      assert.equal(r.status, 200);
      return r.json.data.slots;
    };
    const free1 = (await slotsOf(doctorId)).filter((s) => s.is_available);
    const free2 = new Set((await slotsOf(doctor2)).filter((s) => s.is_available).map((s) => s.start_time));

    // Mga oras na may aktibong SELF booking na si A (hindi pwedeng gamitin bilang T)
    const list = await apiA('GET', '/appointments');
    const busySelf = new Set(
      list.json.data.appointments
        .filter((a) => !a.booked_for && ['pending', 'confirmed'].includes(a.status))
        .map((a) => a.start_time),
    );
    // T: free sa parehong doctor + may katabing free slot kay doctor1 (adjacent test)
    const idx = free1.findIndex(
      (s, i) =>
        free2.has(s.start_time) &&
        !busySelf.has(s.start_time) &&
        free1[i + 1] &&
        free1[i + 1].start_time === s.end_time &&
        !busySelf.has(free1[i + 1].start_time),
    );
    assert.ok(idx >= 0, 'may common free slot na may adjacent next slot');
    const T = free1[idx].start_time.slice(0, 5);
    const Tnext = free1[idx + 1].start_time.slice(0, 5);

    const book = (doc, slot, extra = {}) =>
      apiA('POST', '/appointments', {
        body: {
          doctor_id: doc,
          appointment_date: state.date,
          start_time: slot,
          reason: REASON_A,
          contact_number: CONTACT_A,
          ...extra,
        },
      });

    // 1) Si A kay doctor2 sa T (self) → 201
    assert.equal((await book(doctor2, T)).status, 201, 'unang booking sa T');
    // 2) Si A kay doctor1 sa T (self) → 409: parehong attendee + oras, kahit
    //    free ang slot ni doctor1 (ang per-doctor unique index ay hindi ito
    //    sakop — attendee overlap guard ang humaharang)
    const clash = await book(doctorId, T);
    assert.equal(clash.status, 409, 'attendee overlap → 409');
    assert.match(JSON.stringify(clash.json), /already have an appointment at this time/);
    // 3) Si A kay doctor1 sa T para sa family member → 201 (ibang attendee)
    const fm = await apiA('POST', '/patients/me/family', { body: { full_name: 'Rosa Overlap', relation: 'Aunt' } });
    assert.equal(fm.status, 201);
    assert.equal(
      (await book(doctorId, T, { family_member_id: fm.json.data.member.id })).status,
      201,
      'family member sa parehong oras ay pwede',
    );
    // 4) Si A kay doctor1 sa kasunod na slot (back-to-back sa T) → 201
    assert.equal((await book(doctorId, Tnext)).status, 201, 'adjacent slot ay hindi overlap');
  });

  it('family delete: member na may upcoming appointment → 409; pagka-cancel → 204', async () => {
    const fm = await apiA('POST', '/patients/me/family', { body: { full_name: 'Block Test', relation: 'Sibling' } });
    assert.equal(fm.status, 201);
    const famId = fm.json.data.member.id;

    // Ibang linggo (parehong weekday) para hindi makipag-agawan ng slot sa itaas
    const d = new Date(`${state.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    const date2 = d.toISOString().slice(0, 10);
    const sr = await apiA('GET', `/appointments/slots?doctor_id=${doctorId}&date=${date2}&duration=30`);
    assert.equal(sr.status, 200);
    const free = sr.json.data.slots.find((s) => s.is_available);
    assert.ok(free, 'may free slot sa susunod na linggo');

    const b = await apiA('POST', '/appointments', {
      body: {
        ...bookingBody(free.start_time.slice(0, 5)),
        appointment_date: date2,
        family_member_id: famId,
      },
    });
    assert.equal(b.status, 201);
    assert.equal(b.json.data.appointment.booked_for, 'Block Test');
    const apptId = b.json.data.appointment.id;

    // May upcoming appointment → 409 (hindi 204)
    const blocked = await apiA('DELETE', `/patients/me/family/${famId}`);
    assert.equal(blocked.status, 409);
    assert.match(blocked.json.message, /upcoming/i);

    // Pagka-cancel ng appointment → pwede nang i-delete → 204
    assert.equal((await apiA('POST', `/appointments/${apptId}/cancel`)).status, 200);
    assert.equal((await apiA('DELETE', `/patients/me/family/${famId}`)).status, 204);
  });
});
