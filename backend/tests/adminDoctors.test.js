// backend/tests/adminDoctors.test.js
// Phase 6 — integration: admin doctors CRUD, availability editor,
// portal-access lifecycle (create → login OK → reset → delete → login 401).
// Naka-skip kapag walang backend/.env o Supabase. ≤4 authLimiter hits
// (1 admin + 3 doctor logins).

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

describe('admin integration — Phase 6 doctors CRUD', { skip: !H }, () => {
  let base, server;
  const state = {};
  const adminEmail = H?.uniqueEmail('phase6admin');
  const ADMIN_PASSWORD = 'AdminStr0ng1';
  const DOC_PASSWORD = 'DocStr0ng1';

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
    const spec = await H.supabase.from('specialties').select('id').limit(1).single();
    if (spec.error || !spec.data) throw new Error('kailangan ng kahit 1 specialty row');
    state.specialtyId = spec.data.id;
  });

  after(async () => {
    try {
      if (H && state.doctorAccountId) {
        await H.supabase.from('refresh_tokens').delete().eq('account_kind', 'doctor').eq('account_id', state.doctorAccountId);
        await H.supabase.from('doctor_accounts').delete().eq('id', state.doctorAccountId);
      }
    } catch { /* best-effort */ }
    try {
      if (H && state.doctorId) {
        await H.supabase.from('doctor_weekly_availability').delete().eq('doctor_id', state.doctorId);
        await H.supabase.from('doctors').delete().eq('id', state.doctorId);
      }
    } catch { /* best-effort */ }
    try {
      if (H && adminEmail) await H.cleanupAccount(adminEmail);
    } catch { /* best-effort */ }
    try {
      if (server) server.close();
    } catch { /* ignore */ }
  });

  const pickId = (data) => data?.id ?? data?.doctor?.id ?? null;

  it('POST /admin/doctors → 201', async () => {
    const r = await apiAdmin('POST', '/admin/doctors', {
      body: {
        full_name: 'Dr. Admin Created',
        specialty_id: state.specialtyId,
        status: 'available',
        years_of_experience: 12,
        consultation_fee: 800,
        room: '201',
        gender: 'female',
      },
    });
    assert.equal(r.status, 201, `POST /admin/doctors: ${JSON.stringify(r.json)}`);
    const id = pickId(r.json.data);
    assert.ok(id, 'may id ang created doctor');
    state.doctorId = id;
  });

  it('GET /admin/doctors → 200 at kasama ang bagong doctor', async () => {
    const r = await apiAdmin('GET', '/admin/doctors?limit=100');
    assert.equal(r.status, 200);
    const list = r.json.data.doctors ?? r.json.data;
    const ids = (Array.isArray(list) ? list : []).map((d) => d.id);
    assert.ok(ids.includes(state.doctorId), 'nasa listahan ang created doctor');
  });

  it('GET /admin/doctors/:id → 200', async () => {
    const r = await apiAdmin('GET', `/admin/doctors/${state.doctorId}`);
    assert.equal(r.status, 200);
    const d = r.json.data.doctor ?? r.json.data;
    assert.equal(d.full_name, 'Dr. Admin Created');
  });

  it('PUT /admin/doctors/:id → 200 at nagpe-persist', async () => {
    const r = await apiAdmin('PUT', `/admin/doctors/${state.doctorId}`, {
      body: { consultation_fee: 950 },
    });
    assert.equal(r.status, 200, `PUT: ${JSON.stringify(r.json)}`);
    const g = await apiAdmin('GET', `/admin/doctors/${state.doctorId}`);
    const d = g.json.data.doctor ?? g.json.data;
    assert.equal(d.consultation_fee, 950);
  });

  it('availability editor: POST → 201, PUT → 200, DELETE → 204', async () => {
    const c = await apiAdmin('POST', `/admin/doctors/${state.doctorId}/availability`, {
      body: { weekday: 2, start_time: '09:00', end_time: '12:00' },
    });
    assert.equal(c.status, 201, `POST availability: ${JSON.stringify(c.json)}`);
    const avail = c.json.data.availability ?? c.json.data;
    assert.ok(avail.id, 'may id ang availability');
    const u = await apiAdmin('PUT', `/admin/doctors/${state.doctorId}/availability/${avail.id}`, {
      body: { end_time: '13:00' },
    });
    assert.equal(u.status, 200, `PUT availability: ${JSON.stringify(u.json)}`);
    const d = await apiAdmin('DELETE', `/admin/doctors/${state.doctorId}/availability/${avail.id}`);
    assert.equal(d.status, 204);
    const { data, error } = await H.supabase
      .from('doctor_weekly_availability')
      .select('id')
      .eq('id', avail.id)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data, null, 'burado na sa DB');
  });

  it('portal access: POST → 201, doctor login gumagana', async () => {
    const email = H.uniqueEmail('phase6doc');
    state.doctorEmail = email;
    const r = await apiAdmin('POST', `/admin/doctors/${state.doctorId}/portal-access`, {
      body: { email, password: DOC_PASSWORD },
    });
    assert.equal(r.status, 201, `POST portal-access: ${JSON.stringify(r.json)}`);
    const login = await H.api(base, 'POST', '/auth/login', {
      body: { email, password: DOC_PASSWORD, role: 'doctor' },
    });
    assert.equal(login.status, 200, `doctor login: ${JSON.stringify(login.json)}`);
    assert.equal(login.json.data.role, 'doctor');
    state.doctorToken = login.json.data.accessToken;
    const acc = await H.supabase.from('doctor_accounts').select('id').eq('email', email).single();
    assert.ifError(acc.error);
    state.doctorAccountId = acc.data.id;
  });

  it('portal access reset: POST → 200, bagong password gumagana', async () => {
    const r = await apiAdmin('POST', `/admin/doctors/${state.doctorId}/portal-access/reset`);
    assert.equal(r.status, 200, `POST reset: ${JSON.stringify(r.json)}`);
    // Ang response ay dapat magdala ng bagong password (pangalan ng field
    // ay maaaring mag-iba: password / temporaryPassword / newPassword).
    const newPw = r.json.data?.password ?? r.json.data?.temporaryPassword ?? r.json.data?.newPassword;
    assert.ok(newPw, 'may bagong password sa response');
    const login = await H.api(base, 'POST', '/auth/login', {
      body: { email: state.doctorEmail, password: newPw, role: 'doctor' },
    });
    assert.equal(login.status, 200, `login gamit ang bagong password: ${JSON.stringify(login.json)}`);
  });

  it('portal access delete: DELETE → 204, doctor login → 401', async () => {
    const r = await apiAdmin('DELETE', `/admin/doctors/${state.doctorId}/portal-access`);
    assert.equal(r.status, 204);
    const login = await H.api(base, 'POST', '/auth/login', {
      body: { email: state.doctorEmail, password: DOC_PASSWORD, role: 'doctor' },
    });
    assert.equal(login.status, 401, 'hindi na makaka-login ang doctor');
    state.doctorAccountId = null; // burado na; huwag nang linisin sa after()
  });

  it('DELETE /admin/doctors/:id → 204, tapos GET → 404', async () => {
    const id = state.doctorId;
    const r = await apiAdmin('DELETE', `/admin/doctors/${id}`);
    assert.equal(r.status, 204);
    state.doctorId = null; // burado na; huwag nang linisin sa after()
    const g = await apiAdmin('GET', `/admin/doctors/${id}`);
    assert.equal(g.status, 404);
  });
});
