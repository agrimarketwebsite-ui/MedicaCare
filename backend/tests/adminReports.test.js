/* global fetch */
// backend/tests/adminReports.test.js
// Phase 6 — integration: admin reports (stats, export.csv + formula-guard)
// at activity log viewer (list + ?action= filter).
// Naka-skip kapag walang backend/.env o Supabase. 3 authLimiter hits
// (1 admin login + 1 patient register + 1 patient login).
//
// TANDAAN: ang activity-log assertions ay DITO inilagay (hindi sa
// adminAppointments.test.js) — ang appointment.create activity na ginagawa
// ng file na ito ang ginagamit ng ?action=appointment.create filter test.

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

describe('admin integration — Phase 6 reports + activity', { skip: !H }, () => {
  let base, server;
  const state = { notificationIds: [] };
  const adminEmail = H?.uniqueEmail('phase6admin');
  const patientEmail = H?.uniqueEmail('phase6reportpat');
  const ADMIN_PASSWORD = 'AdminStr0ng1';

  const apiAdmin = (method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state.adminToken });

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
    // Throwaway patient + doctor + availability + appointment —
    // nagge-generate ito ng appointment.create activity para sa filter test.
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: {
        full_name: 'Phase Six Report Patient',
        email: patientEmail,
        phone: '+63 917 830 0001',
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
    const spec = await H.supabase.from('specialties').select('id').limit(1).single();
    if (spec.error) throw new Error('kailangan ng specialty row');
    const doc = await H.supabase
      .from('doctors')
      .insert({ full_name: 'Dr. Admin Report Test', specialty_id: spec.data.id, status: 'available', consultation_fee: 500 })
      .select('id')
      .single();
    if (doc.error) throw new Error(`create doctor: ${doc.error.message}`);
    state.doctorId = doc.data.id;
    const jsDay = new Date(Date.UTC(...manilaToday().split('-').map(Number))).getUTCDay();
    const isoDow = jsDay === 0 ? 7 : jsDay;
    const weekday = (isoDow % 7) + 1;
    const av = await H.supabase
      .from('doctor_weekly_availability')
      .insert({ doctor_id: state.doctorId, weekday, start_time: '09:00', end_time: '12:00' });
    if (av.error) throw new Error(`create availability: ${av.error.message}`);
    const appt = await apiAdmin('POST', '/admin/appointments', {
      body: {
        patient_id: state.patientId,
        doctor_id: state.doctorId,
        appointment_date: targetDate(weekday),
        start_time: '09:00',
        duration_minutes: 30,
        reason: 'Report test visit',
        contact_number: '+63 917 830 0001',
      },
    });
    assert.equal(appt.status, 201, `seed appointment: ${JSON.stringify(appt.json)}`);
    state.apptId = (appt.json.data.appointment ?? appt.json.data).id;
  });

  after(async () => {
    try {
      if (H && state.notificationIds.length) {
        await H.supabase.from('notifications').delete().in('id', state.notificationIds);
      }
    } catch { /* best-effort */ }
    try {
      if (H && state.doctorId) {
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

  async function fetchCsv() {
    const res = await fetch(`${base}/admin/reports/export.csv`, {
      headers: { Authorization: `Bearer ${state.adminToken}` },
    });
    return {
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      text: await res.text(),
    };
  }

  it('GET /admin/reports/stats → 200, may counts', async () => {
    const r = await apiAdmin('GET', '/admin/reports/stats');
    assert.equal(r.status, 200);
    const stats = r.json.data.stats ?? r.json.data;
    assert.equal(typeof stats, 'object');
    const numericCounts = Object.values(stats).filter((v) => typeof v === 'number');
    assert.ok(numericCounts.length >= 1, 'may kahit isang numeric count');
    assert.ok(numericCounts.every((v) => v >= 0), 'walang negative count');
  });

  it('GET /admin/reports/export.csv → 200, content-type ay csv', async () => {
    const csv = await fetchCsv();
    assert.equal(csv.status, 200);
    assert.ok(csv.contentType.toLowerCase().includes('csv'), `content-type=${csv.contentType}`);
    assert.ok(csv.text.length > 0, 'hindi empty ang CSV');
  });

  it('formula-guard: title na nagsisimula sa = ay naka-quote bilang text', async () => {
    const evilTitle = `=HYPERLINK("https://evil.example","click") ${Date.now()}`;
    const n = await apiAdmin('POST', '/admin/notifications', {
      body: {
        patient_id: state.patientId,
        type: 'confirmed',
        title: evilTitle,
        message: 'Formula guard test.',
      },
    });
    assert.equal(n.status, 201);
    const created = n.json.data.notification ?? n.json.data;
    state.notificationIds.push(created.id);
    const csv = await fetchCsv();
    assert.equal(csv.status, 200);
    // Ang export ay dapat mag-prefix ng ' (single quote) para hindi
    // ma-interpret bilang formula ng spreadsheet.
    assert.ok(csv.text.includes("'=HYPERLINK"), 'may formula guard (\'=) sa CSV');
    assert.ok(!csv.text.includes(',=HYPERLINK'), 'walang raw = simula ng cell');
  });

  it('GET /admin/activity → 200 {entries,total}', async () => {
    const r = await apiAdmin('GET', '/admin/activity');
    assert.equal(r.status, 200);
    const d = r.json.data;
    assert.ok(Array.isArray(d.entries), 'may entries array');
    assert.equal(typeof d.total, 'number');
    assert.ok(d.total >= d.entries.length);
  });

  it('GET /admin/activity?action=appointment.create → filter gumagana', async () => {
    const r = await apiAdmin('GET', '/admin/activity?action=appointment.create');
    assert.equal(r.status, 200);
    const d = r.json.data;
    assert.ok(Array.isArray(d.entries), 'may entries array');
    assert.ok(d.entries.length >= 1, 'may appointment.create entry mula sa seed');
    assert.ok(
      d.entries.every((e) => e.action === 'appointment.create'),
      'lahat ng entries ay appointment.create',
    );
    const actors = d.entries.map((e) => e.actor);
    assert.ok(actors.includes(adminEmail), 'kasama ang admin actor');
  });
});
