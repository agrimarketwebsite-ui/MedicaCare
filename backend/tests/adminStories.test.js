// backend/tests/adminStories.test.js
// Phase 6 — integration: admin story moderation (approve → lumalabas sa public
// /api/stories; reject; unpublish → bumabalik sa pending).
// Naka-skip kapag walang backend/.env o Supabase. 3 authLimiter hits
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

describe('admin integration — Phase 6 story moderation', { skip: !H }, () => {
  let base, server;
  const state = { storyIds: [] };
  const adminEmail = H?.uniqueEmail('phase6admin');
  const patientEmail = H?.uniqueEmail('phase6storypat');
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
    // Throwaway patient (kailangan ng patient_id ang patient_stories).
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: {
        full_name: 'Phase Six Story Patient',
        email: patientEmail,
        phone: '+63 917 800 0001',
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
      if (H && state.storyIds.length) {
        await H.supabase.from('patient_stories').delete().in('id', state.storyIds);
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

  async function insertPendingStory(quote) {
    const { data, error } = await H.supabase
      .from('patient_stories')
      .insert({
        patient_id: state.patientId,
        display_name: 'Test Patient',
        quote,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw new Error(`insert story: ${error.message}`);
    state.storyIds.push(data.id);
    return data.id;
  }

  async function storyStatus(id) {
    const { data, error } = await H.supabase
      .from('patient_stories')
      .select('status')
      .eq('id', id)
      .single();
    if (error) throw new Error(`read story: ${error.message}`);
    return data.status;
  }

  /** Public list mula sa GET /api/stories (quotes lang, pang-match). */
  async function publicQuotes() {
    const r = await H.api(base, 'GET', '/stories');
    assert.equal(r.status, 200);
    const list = r.json.data.stories ?? r.json.data ?? [];
    return (Array.isArray(list) ? list : []).map((s) => s.quote);
  }

  it('PATCH /admin/stories/:id/approve → 200 + lumalabas sa public /api/stories', async () => {
    const quote = `Admin approve test quote ${Date.now()}`;
    const id = await insertPendingStory(quote);
    const r = await apiAdmin('PATCH', `/admin/stories/${id}/approve`);
    assert.equal(r.status, 200, `approve: ${JSON.stringify(r.json)}`);
    assert.equal(await storyStatus(id), 'approved');
    assert.ok((await publicQuotes()).includes(quote), 'nasa public list ang approved story');
  });

  it('PATCH /admin/stories/:id/reject → 200 + hindi lumalabas sa public', async () => {
    const quote = `Admin reject test quote ${Date.now()}`;
    const id = await insertPendingStory(quote);
    const r = await apiAdmin('PATCH', `/admin/stories/${id}/reject`);
    assert.equal(r.status, 200, `reject: ${JSON.stringify(r.json)}`);
    assert.equal(await storyStatus(id), 'rejected');
    assert.ok(!(await publicQuotes()).includes(quote), 'wala sa public list ang rejected story');
  });

  it('PATCH /admin/stories/:id/unpublish → 200 + bumabalik sa pending', async () => {
    const quote = `Admin unpublish test quote ${Date.now()}`;
    const id = await insertPendingStory(quote);
    const a = await apiAdmin('PATCH', `/admin/stories/${id}/approve`);
    assert.equal(a.status, 200);
    assert.equal(await storyStatus(id), 'approved');
    const u = await apiAdmin('PATCH', `/admin/stories/${id}/unpublish`);
    assert.equal(u.status, 200, `unpublish: ${JSON.stringify(u.json)}`);
    assert.equal(await storyStatus(id), 'pending');
    assert.ok(!(await publicQuotes()).includes(quote), 'wala na sa public list pagkatapos ng unpublish');
  });
});
