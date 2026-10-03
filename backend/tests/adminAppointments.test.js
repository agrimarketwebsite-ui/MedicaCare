// backend/tests/adminAppointments.test.js
// Phase 6 — integration: admin appointments CRUD (create / status / complete →
// medical_records / delete) + activity_log row sa bawat mutation.
// Naka-skip kapag walang backend/.env o Supabase. 3 authLimiter hits
// (1 admin login + 1 patient register + 1 patient login).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { manilaToday } from '../shared/utils/manilaTime.js';
import { hashPassword } from '../shared/utils/passwords.js';

let H = null;
try {
  H = await import('./auth.helpers.js');
  const probe = await H.supabase.from('specialties').select('id', { count: 'exact', head: true });
  if (probe.error) throw probe.error;
} catch {
  H = null;
}

describe('admin integration — Phase 6 appointments CRUD', { skip: !H }, () => {
  let base, server;
  const state = {};
  const adminEmail = H?.uniqueEmail('phase6admin');
  const patientEmail = H?.uniqueEmail('phase6pat');
  const ADMIN_PASSWORD = 'AdminStr0ng1';

  const apiAdmin = (method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state.adminToken });

  /** Susunod na petsa (Manila) na tugma sa weekday — laging future. */
  function targetDate(weekday) {
    const [y, m, d] = manilaToday().split('-').map(Number);
    const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    let delta = (weekday - isoDow + 7) % 7;
    if (delta === 0) delta = 7;
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
  }

  /** Pinakabagong activity_log row ng admin actor na ang action ay nagsisimula sa prefix. */
  async function latestActivity(actionPrefix) {
    const { data, error } = await H.supabase
      .from('activity_log')
      .select('actor, action, created_at')
      .eq('actor', adminEmail)
      .like('action', `${actionPrefix}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`activity_log query: ${error.message}`);
    return data?.[0] ?? null;
  }

  async function assertActivityLogged(actionPrefix, sinceIso, label) {
    const row = await latestActivity(actionPrefix);
    assert.ok(row, `${label}: may activity_log row`);
    assert.ok(
      new Date(row.created_at) >= new Date(sinceIso),
      `${label}: activity ay bago (created_at=${row.created_at})`,
    );
  }

  before(async () => {
    ({ base, server } = await H.bootApp());
    const password_hash = await hashPassword(ADMIN_PASSWORD);
    const ins = await H.supabase
      .from('admins')
      .insert({ full_name: 'Phase Six Admin', email: adminEmail, password_hash })
      .select('id')
      .single();
    if (ins.error) throw new Error(`create admin: ${ins.error.message}`);
    state.adminId = ins.data.id;
    const login = await H.api(base, 'POST', '/auth/login', {
      body: { email: adminEmail, password: ADMIN_PASSWORD, role: 'admin' },
    });
    assert.equal(login.status, 200, `admin login: ${JSON.stringify(login.json)}`);
    state.adminToken = login.json.data.accessToken;
    // Throwaway patient.
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: {
        full_name: 'Phase Six Appointment Patient',
        email: patientEmail,
        phone: '+63 917 700 0001',
        password: 'Str0ngPass1',
      },
    });
    assert.equal(reg.status, 201);
    const plogin = await H.api(base, 'POST', '/auth/login', {
      body: { email: patientEmail, password: 'Str0ngPass1' },
    });
    assert.equal(plogin.status, 200);
    const me = await H.api(base, 'GET', '/patients/me', { token: plogin.json.data.accessToken });
    assert.equal(me.status, 200);
    state.patientId = me.json.data.patient.id;
    // Throwaway doctor (direktang insert) + availability sa isang future weekday.
    const spec = await H.supabase.from('specialties').select('id').limit(1).single();
    if (spec.error) throw new Error('kailangan ng specialty row');
    const doc = await H.supabase
      .from('doctors')
      .insert({ full_name: 'Dr. Admin Appt Test', specialty_id: spec.data.id, status: 'available', consultation_fee: 500, room: '101', gender: 'male' })
      .select('id')
      .single();
    if (doc.error) throw new Error(`create doctor: ${doc.error.message}`);
    state.doctorId = doc.data.id;
    const jsDay = new Date(Date.UTC(...manilaToday().split('-').map(Number))).getUTCDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    state.weekday = (isoDow % 7) + 1; // bukas (ISO 1–7)
    const av = await H.supabase
      .from('doctor_weekly_availability')
      .insert({ doctor_id: state.doctorId, weekday: state.weekday, start_time: '09:00', end_time: '12:00' });
    if (av.error) throw new Error(`create availability: ${av.error.message}`);
    state.date = targetDate(state.weekday);
  });

  after(async () => {
    try {
      if (H && state.doctorId) {
        await H.supabase.from('medical_records').delete().eq('doctor_id', state.doctorId);
        await H.supabase.from('appointments').delete().eq('doctor_id', state.doctorId);
        await H.supabase.from('doctor_weekly_availability').delete().eq('doctor_id', state.doctorId);
        await H.supabase.from('doctors').delete().eq('id', state.doctorId);
      }
    } catch { /* best-effort */ }
    try {
      if (H && patientEmail) await H.cleanupAccount(patientEmail);
    } catch { /* best-effort */ }
    try {
      if (H && adminEmail) await H.cleanupAccount(adminEmail);
    } catch { /* best-effort */ }
    try {
      if (server) server.close();
    } catch { /* ignore */ }
  });

  const pickAppt = (data) => data?.appointment ?? data;

  async function createAppointment(overrides = {}) {
    const since = new Date().toISOString();
    const r = await apiAdmin('POST', '/admin/appointments', {
      body: {
        patient_id: state.patientId,
        doctor_id: state.doctorId,
        appointment_date: state.date,
        start_time: '09:00',
        duration_minutes: 30,
        reason: 'Admin-created test visit',
        contact_number: '+63 917 700 0001',
        ...overrides,
      },
    });
    assert.equal(r.status, 201, `POST /admin/appointments: ${JSON.stringify(r.json)}`);
    const appt = pickAppt(r.json.data);
    assert.ok(appt.id, 'may id ang created appointment');
    await assertActivityLogged('appointment', since, 'appointment.create');
    return appt;
  }

  it('POST /admin/appointments → 201 + activity_log row', async () => {
    const appt = await createAppointment();
    state.apptId = appt.id;
    // Eksaktong action name para sa create (ginagamit din ng ?action= filter).
    const row = await latestActivity('appointment.create');
    assert.ok(row, 'may appointment.create activity row');
    assert.equal(row.actor, adminEmail);
  });

  it('PATCH /admin/appointments/:id/status → 200 + activity_log row', async () => {
    const since = new Date().toISOString();
    const r = await apiAdmin('PATCH', `/admin/appointments/${state.apptId}/status`, {
      body: { status: 'confirmed' },
    });
    assert.equal(r.status, 200, `PATCH status: ${JSON.stringify(r.json)}`);
    const appt = pickAppt(r.json.data);
    assert.equal(appt.status, 'confirmed');
    await assertActivityLogged('appointment', since, 'appointment.status');
  });

  it('POST /admin/appointments/:id/complete → 200 + medical_records row + activity_log', async () => {
    const since = new Date().toISOString();
    const r = await apiAdmin('POST', `/admin/appointments/${state.apptId}/complete`, {
      body: { notes: 'Admin-completed visit: patient examined, all vitals normal.' },
    });
    assert.equal(r.status, 200, `POST complete: ${JSON.stringify(r.json)}`);
    const appt = pickAppt(r.json.data);
    assert.equal(appt.status, 'completed');
    const rec = await H.supabase
      .from('medical_records')
      .select('id, title')
      .eq('appointment_id', state.apptId)
      .maybeSingle();
    assert.ifError(rec.error);
    assert.ok(rec.data, 'may medical_records row para sa completed appointment');
    await assertActivityLogged('appointment', since, 'appointment.complete');
  });

  it('DELETE /admin/appointments/:id → 204 + activity_log row', async () => {
    const appt = await createAppointment({ start_time: '10:00', reason: 'To be deleted' });
    const since = new Date().toISOString();
    const d = await apiAdmin('DELETE', `/admin/appointments/${appt.id}`);
    assert.equal(d.status, 204);
    const gone = await H.supabase.from('appointments').select('id').eq('id', appt.id).maybeSingle();
    assert.ifError(gone.error);
    assert.equal(gone.data, null, 'burado na ang appointment sa DB');
    await assertActivityLogged('appointment', since, 'appointment.delete');
  });
});
