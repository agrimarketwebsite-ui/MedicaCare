// backend/tests/adminSettings.test.js
// Phase 6 — integration: admin clinic + app settings (GET/PUT, nagpe-persist,
// nire-restore ang original pagkatapos). Naka-skip kapag walang backend/.env
// o Supabase. 1 authLimiter hit (admin login lang).
//
// TANDAAN: ang app-settings PUT ay panandaliang binabago ang singleton row —
// nire-restore agad sa loob ng test at ulit sa after() (best-effort), para
// hindi maapektuhan ang ibang test files na tumatakbo nang sabay.

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

describe('admin integration — Phase 6 settings', { skip: !H }, () => {
  let base, server;
  const state = {};
  const adminEmail = H?.uniqueEmail('phase6admin');
  const ADMIN_PASSWORD = 'AdminStr0ng1';

  const apiAdmin = (method, path, opts) =>
    H.api(base, method, path, { ...opts, token: state.adminToken });

  async function restoreSettings() {
    if (state.origClinic) {
      await H.supabase.from('clinic_info').update(state.origClinic).eq('id', 1);
    }
    if (state.origApp) {
      await H.supabase.from('app_settings').update(state.origApp).eq('id', 1);
    }
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
    // I-save ang original singleton rows para ma-restore.
    const clinic = await H.supabase
      .from('clinic_info')
      .select('name, short_name, tagline, phone, email, address, hours')
      .eq('id', 1)
      .single();
    if (clinic.error) throw new Error(`read clinic_info: ${clinic.error.message}`);
    state.origClinic = clinic.data;
    const app = await H.supabase
      .from('app_settings')
      .select('auto_confirm_appointments, slot_interval_minutes, email_admins_on_new_appointment, remind_patients')
      .eq('id', 1)
      .single();
    if (app.error) throw new Error(`read app_settings: ${app.error.message}`);
    state.origApp = app.data;
  });

  after(async () => {
    try {
      if (H) await restoreSettings();
    } catch { /* best-effort */ }
    try {
      if (H && adminEmail) await H.cleanupAccount(adminEmail);
    } catch { /* best-effort */ }
    try {
      if (server) server.close();
    } catch { /* ignore */ }
  });

  it('GET /admin/clinic → 200, may clinic info', async () => {
    const r = await apiAdmin('GET', '/admin/settings/clinic');
    assert.equal(r.status, 200);
    const clinic = r.json.data.clinic ?? r.json.data;
    assert.ok(clinic.name, 'may clinic name');
  });

  it('PUT /admin/clinic → 200 at nagpe-persist (tapos restore)', async () => {
    const newName = `MedicaCare Test Clinic ${Date.now()}`;
    const u = await apiAdmin('PUT', '/admin/settings/clinic', { body: { name: newName } });
    assert.equal(u.status, 200, `PUT clinic: ${JSON.stringify(u.json)}`);
    const g = await apiAdmin('GET', '/admin/settings/clinic');
    const clinic = g.json.data.clinic ?? g.json.data;
    assert.equal(clinic.name, newName, 'nag-persist ang bagong name');
    // Ibalik agad ang original.
    const back = await apiAdmin('PUT', '/admin/settings/clinic', { body: { name: state.origClinic.name } });
    assert.equal(back.status, 200);
  });

  it('GET /admin/app → 200, may appointment preferences', async () => {
    const r = await apiAdmin('GET', '/admin/settings/app');
    assert.equal(r.status, 200);
    const prefs = r.json.data.preferences ?? r.json.data.app ?? r.json.data;
    assert.equal(typeof prefs.auto_confirm_appointments, 'boolean');
    assert.equal(typeof prefs.slot_interval_minutes, 'number');
  });

  it('PUT /admin/app → 200 at nagpe-persist (tapos restore)', async () => {
    const u = await apiAdmin('PUT', '/admin/settings/app', {
      body: { auto_confirm_appointments: true, slot_interval_minutes: 30 },
    });
    assert.equal(u.status, 200, `PUT app: ${JSON.stringify(u.json)}`);
    const g = await apiAdmin('GET', '/admin/settings/app');
    const prefs = g.json.data.preferences ?? g.json.data.app ?? g.json.data;
    assert.equal(prefs.auto_confirm_appointments, true);
    assert.equal(prefs.slot_interval_minutes, 30);
    // Ibalik agad ang original values.
    const back = await apiAdmin('PUT', '/admin/settings/app', {
      body: {
        auto_confirm_appointments: state.origApp.auto_confirm_appointments,
        slot_interval_minutes: state.origApp.slot_interval_minutes,
      },
    });
    assert.equal(back.status, 200);
  });
});
