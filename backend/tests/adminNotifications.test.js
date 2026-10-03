// backend/tests/adminNotifications.test.js
// Phase 6 — integration: admin notifications (create + list).
// Naka-skip kapag walang backend/.env o Supabase. 3 authLimiter hits
// (1 admin login + 1 patient register + 1 patient login).
//
// TANDAAN (schema assumption, i-verify sa Phase 6 migration):
//   notifications(patient_id, type, title, message).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../shared/utils/passwords.js';

let H = null;
try {
  H = await import('./auth.helpers.js');
  const probe = await H.supabase.from('specialties').select('id', { count: 'exact', head: true });
  if (probe.error) throw probe.error;
} catch {
  H = null;
}

describe('admin integration — Phase 6 notifications', { skip: !H }, () => {
  let base, server;
  const state = { notificationIds: [] };
  const adminEmail = H?.uniqueEmail('phase6admin');
  const patientEmail = H?.uniqueEmail('phase6notifpat');
  const ADMIN_PASSWORD = 'AdminStr0ng1';

  const apiAdmin = (method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state.adminToken });

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
    // Throwaway patient (kailangan ng patient_id ang notifications).
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: {
        full_name: 'Phase Six Notification Patient',
        email: patientEmail,
        phone: '+63 917 820 0001',
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
  });

  after(async () => {
    try {
      if (H && state.notificationIds.length) {
        await H.supabase.from('notifications').delete().in('id', state.notificationIds);
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

  it('POST /admin/notifications → 201', async () => {
    const r = await apiAdmin('POST', '/admin/notifications', {
      body: {
        patient_id: state.patientId,
        type: 'confirmed',
        title: 'Appointment confirmed',
        message: 'Your appointment has been confirmed by the clinic.',
      },
    });
    assert.equal(r.status, 201, `POST notification: ${JSON.stringify(r.json)}`);
    const n = r.json.data.notification ?? r.json.data;
    assert.ok(n.id, 'may id ang created notification');
    assert.equal(n.patient_id, state.patientId);
    state.notificationIds.push(n.id);
    state.createdId = n.id;
  });

  it('GET /admin/notifications → 200 at kasama ang ginawa', async () => {
    const r = await apiAdmin('GET', '/admin/notifications');
    assert.equal(r.status, 200);
    const list = r.json.data.notifications ?? r.json.data;
    const ids = (Array.isArray(list) ? list : []).map((n) => n.id);
    assert.ok(ids.includes(state.createdId), 'nasa listahan ang created notification');
  });
});
