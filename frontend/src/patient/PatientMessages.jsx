// PatientMessages — patient (split from screens-patient.jsx)
import { useEffect, useState } from 'react';
import { AppShell, Badge, EmptyState, Field, Icon, PageHeader, PageSpinner, TextArea, TextInput, useStore } from '../shared/components.jsx';

import { localToday, focusFirstError } from './helpers.js';

// ---------- My messages (patient portal — dedicated page) ----------
// "Message the clinic" used to be a card at the bottom of Help & support; it
// now has its own page (sidebar: My messages) so conversations don't compete
// with the FAQs. Submissions are kept in the portal (no patient-facing
// messages API endpoint exists yet — staff replies arrive once a staff
// messaging endpoint is connected).
function PatientMessages() {
  const store = useStore();
  const me = store.currentPatient || window.CURRENT_PATIENT;
  // Simulated fetch — centered circle spinner while "loading", same 600ms
  // pattern as the other patient pages
  const [pageLoading, setPageLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPageLoading(false), 600); return () => clearTimeout(t); }, []);

  const [msgForm, setMsgForm] = useState({ subject: '', message: '' });
  const [msgErrors, setMsgErrors] = useState({});
  const meId = me.id || me.patient_id;
  const myTickets = (store.tickets || []).filter(t => String(t.patientId) === String(meId));
  const updateMsg = (k, v) => { setMsgForm(f => ({ ...f, [k]: v })); if (msgErrors[k]) setMsgErrors(e => ({ ...e, [k]: null })); };

  const submitMsg = (e) => {
    e.preventDefault();
    const errs = {};
    if (!msgForm.subject.trim()) errs.subject = 'Please enter a subject';
    const m = msgForm.message.trim();
    if (!m) errs.message = 'Please write your message';
    else if (m.length < 10) errs.message = 'Please provide a bit more detail (10+ characters)';
    setMsgErrors(errs);
    if (Object.keys(errs).length) { focusFirstError(); return; }
    store.setTickets([{
      id: 'tkt' + Date.now(),
      patientId: meId,
      name: me.name || me.full_name,
      subject: msgForm.subject.trim(),
      message: m,
      status: 'open',
      createdAt: localToday(),
      reply: '',
      repliedAt: null,
    }, ...(store.tickets || [])]);
    setMsgForm({ subject: '', message: '' });
    store.pushToast({ title: 'Message sent', msg: 'Our staff will reply here in your portal.' });
  };

  // Follow-up on a replied ticket — reopens it as "open" so staff can answer
  // again; the whole conversation stays visible on both sides via t.thread
  const [fuId, setFuId] = useState(null);
  const [fuText, setFuText] = useState('');
  const [fuError, setFuError] = useState('');
  const sendFollowUp = (t) => {
    const text = fuText.trim();
    if (text.length < 10) { setFuError('Please write a bit more (10+ characters).'); focusFirstError(); return; }
    store.setTickets((store.tickets || []).map(x => x.id === t.id
      ? {
          ...x,
          status: 'open',
          thread: [...(x.thread || []), { id: x.id + '-fu' + Date.now(), from: 'patient', text, date: localToday() }],
        }
      : x));
    store.pushToast({ title: 'Follow-up sent', msg: 'Our staff will reply here in your portal.' });
    setFuId(null); setFuText(''); setFuError('');
  };

  if (pageLoading) {
    return (
      <AppShell current="messages">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

  return (
    <AppShell current="messages">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="My messages"
          subtitle="Message the clinic — staff replies arrive right here in your portal."
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'My messages' }]}
        />
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2 className="h-section">Message the clinic</h2>
            <span className="t-muted" style={{ fontSize: 12 }}>
              {myTickets.filter(t => t.status === 'open').length} awaiting reply
            </span>
          </div>
          <form onSubmit={submitMsg} noValidate>
            <div className="card-body stack md">
              <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                Questions about schedules, billing, or HMO? Send a message and our staff will reply
                here in your portal — usually within one business day.
              </p>
              <Field label="Subject" required error={msgErrors.subject}>
                <TextInput value={msgForm.subject} onChange={e => updateMsg('subject', e.target.value)} error={msgErrors.subject} maxLength={80} placeholder="e.g., HMO coverage question" />
              </Field>
              <Field label="Message" required error={msgErrors.message} help={`${msgForm.message.trim().length}/500 characters. Minimum 10.`}>
                <TextArea
                  rows={4}
                  placeholder="How can we help you?"
                  value={msgForm.message}
                  onChange={e => updateMsg('message', e.target.value)}
                  error={msgErrors.message}
                  maxLength={500}
                />
              </Field>
              <div>
                <button type="submit" className="btn btn-primary"><Icon name="send" size={14} /> Send message</button>
              </div>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="h-section">Your messages</h2>
            <span className="t-muted" style={{ fontSize: 12 }}>
              {myTickets.length} message{myTickets.length === 1 ? '' : 's'}
            </span>
          </div>
          {myTickets.length === 0 ? (
            <div style={{ padding: '8px 20px 16px' }}>
              <EmptyState icon="inbox" title="No messages yet"
                message="Send your first message above. Staff replies will appear right here." />
            </div>
          ) : (
            <div className="stack md" style={{ padding: '16px 20px 20px' }}>
              {myTickets.map(t => (
                <div key={t.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge kind={t.status === 'resolved' ? 'success' : 'warning'} dot={false}>
                      {t.status === 'resolved' ? 'Replied by staff' : 'Awaiting reply'}
                    </Badge>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.subject}</span>
                    <span className="t-muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{window.formatDate(t.createdAt)}</span>
                  </div>
                  <div className="t-muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{t.message}</div>
                  {(t.thread || []).map(m => m.from === 'staff' ? (
                    <div key={m.id} style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, background: 'var(--success-soft)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '8px 10px', color: 'var(--success-text)' }}>
                      <strong>Staff reply:</strong> {m.text}
                      {m.date && <div className="t-help" style={{ marginTop: 2 }}>{window.formatDate(m.date)}</div>}
                    </div>
                  ) : (
                    <div key={m.id} style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                      <strong>You replied:</strong> {m.text}
                      {m.date && <div className="t-help" style={{ marginTop: 2 }}>{window.formatDate(m.date)}</div>}
                    </div>
                  ))}
                  {!t.thread && t.reply && (
                    <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, background: 'var(--success-soft)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '8px 10px', color: 'var(--success-text)' }}>
                      <strong>Staff reply:</strong> {t.reply}
                    </div>
                  )}
                  {t.status === 'resolved' && fuId !== t.id && (
                    <button type="button" className="btn btn-ghost sm" style={{ marginTop: 8 }} onClick={() => { setFuId(t.id); setFuText(''); setFuError(''); }}>
                      <Icon name="reply" size={13} /> Send follow-up
                    </button>
                  )}
                  {t.status === 'resolved' && fuId === t.id && (
                    <div style={{ marginTop: 8 }}>
                      <Field label="Your follow-up" required error={fuError} help={`${fuText.trim().length}/500 characters. Minimum 10.`}>
                        <TextArea rows={3} value={fuText} maxLength={500}
                          onChange={e => { setFuText(e.target.value); if (fuError) setFuError(''); }}
                          placeholder="e.g., Thank you! One more question about the schedule…" />
                      </Field>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-primary sm" onClick={() => sendFollowUp(t)}>Send</button>
                        <button type="button" className="btn btn-secondary sm" onClick={() => { setFuId(null); setFuText(''); setFuError(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export { PatientMessages };
