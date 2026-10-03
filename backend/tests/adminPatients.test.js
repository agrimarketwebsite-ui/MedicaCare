// backend/tests/adminPatients.test.js
// Phase 6 — integration: admin patients CRUD + [ENC] ciphertext-at-rest +
// role checks (patient JWT → 403, walang token → 401).
// Kailangan ng backend/.env + Supabase + naka-mount na /api/admin routes;
// kung wala, naka-skip ang suite (hindi failure). Bawat test FILE ay sariling
// process (sariling rate-limiter memory): ≤3 authLimiter hits dito
// (1 admin login + 1 patient register + 1 patient login).

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

describe('admin integration — Phase 6 patients CRUD', { skip: !H }, () => {
  let base, server;
  const state = { patientIds: [] };
  const adminEmail = H?.uniqueEmail('phase6admin');
  const patientEmail = H?.uniqueEmail('phase6pat403');
  const ADMIN_PASSWORD = 'AdminStr0ng1';
  const PATIENT_PASSWORD = 'Str0ngPass1';

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
    assert.equal(login.json.data.role, 'admin');
    state.adminToken = login.json.data.accessToken;
    // Patient account para sa 403 role check.
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: {
        full_name: 'Phase Six Patient',
        email: patientEmail,
        phone: '+63 917 600 0001',
        password: PATIENT_PASSWORD,
      },
    });
    assert.equal(reg.status, 201, `patient register: ${JSON.stringify(reg.json)}`);
    const plogin = await H.api(base, 'POST', '/auth/login', {
      body: { email: patientEmail, password: PATIENT_PASSWORD },
    });
    assert.equal(plogin.status, 200, 'patient login');
    state.patientToken = plogin.json.data.accessToken;
  });

  after(async () => {
    try {
      if (H && state.patientIds.length) {
        await H.supabase.from('patients').delete().in('id', state.patientIds);
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

  /** Kunin ang id kahit naka-nest ang response ({patient:{...}} o diretso). */
  const pickId = (data) => data?.id ?? data?.patient?.id ?? null;

  async function createPatient(overrides = {}) {
    const r = await apiAdmin('POST', '/admin/patients', {
      body: {
        full_name: 'Admin Created Patient',
        email: H.uniqueEmail('phase6crud'),
        phone: '+63 917 600 0002',
        password: PATIENT_PASSWORD,
        ...overrides,
      },
    });
    assert.equal(r.status, 201, `POST /admin/patients: ${JSON.stringify(r.json)}`);
    const id = pickId(r.json.data);
    assert.ok(id, 'may id ang created patient');
    state.patientIds.push(id);
    return { id, res: r };
  }

  it('role check: patient JWT → 403 sa GET /admin/patients', async () => {
    const r = await H.api(base, 'GET', '/admin/patients', { token: state.patientToken });
    assert.equal(r.status, 403);
  });

  it('role check: walang token → 401 sa GET /admin/patients', async () => {
    const r = await H.api(base, 'GET', '/admin/patients');
    assert.equal(r.status, 401);
  });

  it('GET /admin/patients → 200 {patients,total,page,limit} + pagination', async () => {
    await createPatient();
    await createPatient();
    const r = await apiAdmin('GET', '/admin/patients?page=1&limit=1');
    assert.equal(r.status, 200);
    const d = r.json.data;
    assert.ok(Array.isArray(d.patients), 'may patients array');
    assert.equal(typeof d.total, 'number');
    assert.equal(d.page, 1);
    assert.equal(d.limit, 1);
    assert.ok(d.total >= 2, 'total ay ≥ 2');
    assert.ok(d.patients.length <= 1, 'limit=1 sinusunod');
  });

  it('GET /admin/patients?q= → hinahanap sa pangalan', async () => {
    const { id } = await createPatient({ full_name: 'Zzq Unique Searchname' });
    const r = await apiAdmin('GET', '/admin/patients?q=zzq%20unique');
    assert.equal(r.status, 200);
    const ids = (r.json.data.patients || []).map((p) => p.id);
    assert.ok(ids.includes(id), 'nahanap ang patient sa q');
  });

  it('POST /admin/patients → 201 + GET /:id → 200 (decrypted [ENC] fields)', async () => {
    const { id } = await createPatient({
      full_name: 'Enc Check Patient',
      blood_type: 'O+',
      allergies: 'Penicillin, peanuts',
    });
    const g = await apiAdmin('GET', `/admin/patients/${id}`);
    assert.equal(g.status, 200);
    const p = g.json.data.patient ?? g.json.data;
    assert.equal(p.full_name, 'Enc Check Patient');
    assert.equal(p.blood_type, 'O+', 'blood_type decrypted sa read');
    assert.ok(String(p.allergies || '').includes('Penicillin'), 'allergies decrypted sa read');
  });

  it('[ENC] ciphertext-at-rest: raw row ay nagsisimula sa v1:', async () => {
    const { id } = await createPatient({
      full_name: 'Cipher At Rest',
      blood_type: 'A-',
      allergies: 'Latex',
    });
    const { data, error } = await H.supabase
      .from('patients')
      .select('blood_type, allergies')
      .eq('id', id)
      .single();
    assert.ifError(error);
    assert.ok(String(data.blood_type).startsWith('v1:'), 'blood_type naka-encrypt sa DB');
    assert.ok(String(data.allergies).startsWith('v1:'), 'allergies naka-encrypt sa DB');
  });

  it('PUT /admin/patients/:id → 200 at nagpe-persist', async () => {
    const { id } = await createPatient();
    const u = await apiAdmin('PUT', `/admin/patients/${id}`, {
      body: { full_name: 'Renamed By Admin' },
    });
    assert.equal(u.status, 200, `PUT: ${JSON.stringify(u.json)}`);
    const g = await apiAdmin('GET', `/admin/patients/${id}`);
    const p = g.json.data.patient ?? g.json.data;
    assert.equal(p.full_name, 'Renamed By Admin');
  });

  it('DELETE /admin/patients/:id → 204, tapos GET → 404', async () => {
    const { id } = await createPatient();
    const d = await apiAdmin('DELETE', `/admin/patients/${id}`);
    assert.equal(d.status, 204);
    state.patientIds = state.patientIds.filter((x) => x !== id);
    const g = await apiAdmin('GET', `/admin/patients/${id}`);
    assert.equal(g.status, 404);
  });
});
