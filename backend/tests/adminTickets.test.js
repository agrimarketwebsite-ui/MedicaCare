// backend/tests/adminTickets.test.js
// Phase 6 — integration: admin support tickets (reply bilang staff, resolve).
// Ang ticket + unang message ay direktang ini-insert via supabase (kailangan
// ng patient_id). Naka-skip kapag walang backend/.env o Supabase.
// 3 authLimiter hits (1 admin login + 1 patient register + 1 patient login).
//
// TANDAAN (schema assumption, i-verify sa Phase 6 migration):
//   support_tickets(patient_id, subject, status) +
//   support_ticket_messages(ticket_id, sender, body).

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

describe('admin integration — Phase 6 support tickets', { skip: !H }, () => {
  let base, server;
  const state = {};
  const adminEmail = H?.uniqueEmail('phase6admin');
  const patientEmail = H?.uniqueEmail('phase6ticketpat');
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
    // Throwaway patient (kailangan ng patient_id ang support_tickets).
    const reg = await H.api(base, 'POST', '/auth/register', {
      body: {
        full_name: 'Phase Six Ticket Patient',
        email: patientEmail,
        phone: '+63 917 810 0001',
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
    // Ticket + patient message, direktang insert.
    const t = await H.supabase
      .from('support_tickets')
      .insert({ patient_id: state.patientId, subject: 'Admin reply test ticket', status: 'open' })
      .select('id')
      .single();
    if (t.error) throw new Error(`insert ticket: ${t.error.message}`);
    state.ticketId = t.data.id;
    const m = await H.supabase
      .from('support_ticket_messages')
      .insert({ ticket_id: state.ticketId, sender: 'patient', body: 'Hello, I need help with my booking.' });
    if (m.error) throw new Error(`insert ticket message: ${m.error.message}`);
  });

  after(async () => {
    try {
      if (H && state.ticketId) {
        await H.supabase.from('support_ticket_messages').delete().eq('ticket_id', state.ticketId);
        await H.supabase.from('support_tickets').delete().eq('id', state.ticketId);
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

  it('POST /admin/tickets/:id/reply → 201, sender=staff', async () => {
    const body = `Staff reply ${Date.now()}: noted, we will assist you.`;
    const r = await apiAdmin('POST', `/admin/tickets/${state.ticketId}/reply`, { body: { body } });
    assert.equal(r.status, 201, `reply: ${JSON.stringify(r.json)}`);
    const msg = r.json.data.message ?? r.json.data;
    assert.equal(msg.sender, 'staff', 'ang reply ay galing sa staff');
    // Verify sa DB: may staff message row talaga.
    const { data, error } = await H.supabase
      .from('support_ticket_messages')
      .select('id')
      .eq('ticket_id', state.ticketId)
      .eq('sender', 'staff')
      .limit(1);
    assert.ifError(error);
    assert.ok(data.length >= 1, 'may staff message row sa DB');
  });

  it('PATCH /admin/tickets/:id/resolve → 200, status resolved/closed', async () => {
    const r = await apiAdmin('PATCH', `/admin/tickets/${state.ticketId}/resolve`);
    assert.equal(r.status, 200, `resolve: ${JSON.stringify(r.json)}`);
    const { data, error } = await H.supabase
      .from('support_tickets')
      .select('status')
      .eq('id', state.ticketId)
      .single();
    assert.ifError(error);
    assert.ok(['resolved', 'closed'].includes(data.status), `status=${data.status}`);
  });
});
