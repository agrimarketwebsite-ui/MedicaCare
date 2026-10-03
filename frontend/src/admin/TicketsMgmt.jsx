// TicketsMgmt — patient support messages (Phase 6).
// Two-card layout restored from the prototype: "Open" and "Resolved".
// Reply modal sends the reply AND resolves the ticket in one step.
// Ticket shape: { id, subject, status, created_at, patient: { id, full_name, email } }.
// Thread: getAdminTicket(id) → { ticket, messages: [{ id, sender, body, created_at }] }
// (sender is 'patient' for patient messages, 'staff' for staff replies).
import { useEffect, useState } from 'react';
import {
  AppShell, Badge, EmptyState, ErrorState, Field, Icon, Modal,
  PageHeader, PatientAvatar, TextArea, useStore,
} from '../shared/components.jsx';
import { formatDate } from '../shared/data.js';
import { getAdminTicket, getAdminTickets, replyTicket, resolveTicket, ApiError } from '../shared/api.js';
import { focusFirstError } from './helpers.js';

// ---------- Patient messages (support tickets) ----------
// Patients send questions from the portal's Help & support page ("Message the
// clinic"); they land here as open tickets. Staff reply once — the reply shows
// in the patient's portal and the ticket is marked resolved (same loop as the
// patient stories moderation flow).
function TicketsMgmt() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState([]);
  // threads: { [ticketId]: messages[] } — loaded alongside the list so rows
  // can show the full message and the staff reply callout
  const [threads, setThreads] = useState({});
  const [retryKey, setRetryKey] = useState(0);
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getAdminTickets('');
      setTickets(list);
      // Fetch each ticket's thread in parallel; a single failure must not
      // break the whole list
      const entries = await Promise.all(list.map(async (t) => {
        try {
          const d = await getAdminTicket(t.id);
          return [t.id, d.messages || []];
        } catch {
          return [t.id, null];
        }
      }));
      setThreads(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message || 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = tickets.filter((t) => t.status === 'open');
  const resolved = tickets.filter((t) => t.status === 'resolved');

  const startReply = (t) => { setReplyFor(t); setReplyText(''); setReplyError(''); };

  const sendReply = async () => {
    const text = replyText.trim();
    if (text.length < 10) { setReplyError('Please write a reply (10+ characters).'); focusFirstError(); return; }
    setSending(true);
    try {
      // The prototype sends the reply AND resolves in one step
      await replyTicket(replyFor.id, { body: text });
      await resolveTicket(replyFor.id);
      store.pushToast({
        kind: 'success',
        title: 'Reply sent',
        msg: `${replyFor.patient?.full_name || 'The patient'} will see your response in their portal.`,
      });
      setReplyFor(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Reply failed', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const rowSkeletons = (count) => Array.from({ length: count }).map((_, i) => (
    <div key={i} className="list-item" aria-hidden="true">
      <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
      <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="skel" style={{ height: 11, width: '55%' }} />
        <span className="skel" style={{ height: 10, width: '80%' }} />
      </div>
      <span className="skel" style={{ width: 74, height: 22, borderRadius: 'var(--r-pill)', flexShrink: 0 }} />
    </div>
  ));

  const TicketRow = ({ t, actions, children }) => {
    const msgs = threads[t.id] || [];
    const patientMsgs = msgs.filter((m) => m.sender === 'patient');
    const staffMsgs = msgs.filter((m) => m.sender === 'staff');
    const original = patientMsgs[0]?.body || '';
    const followUps = Math.max(0, patientMsgs.length - 1);
    const lastReply = staffMsgs.length > 0 ? staffMsgs[staffMsgs.length - 1] : null;
    const name = t.patient?.full_name || 'Patient';
    return (
      <div className="list-item" style={{ alignItems: 'flex-start' }}>
        <PatientAvatar person={{ name }} size={28} />
        <div className="list-item-body">
          <div className="list-item-title">{t.subject || 'Support ticket'}</div>
          {/* Override the one-line ellipsis: the message body is the content here */}
          <div className="list-item-sub" style={{ whiteSpace: 'normal', overflow: 'visible', lineHeight: 1.5 }}>
            {original}
          </div>
          {followUps > 0 && (
            <div className="list-item-sub" style={{ marginTop: 4 }}>
              {followUps} patient follow-up{followUps === 1 ? '' : 's'}. See reply history
            </div>
          )}
          <div className="list-item-sub" style={{ marginTop: 4 }}>
            {name} · sent {formatDate((t.created_at || '').slice(0, 10))}
            {lastReply ? ` · replied ${formatDate((lastReply.created_at || '').slice(0, 10))}` : ''}
          </div>
          {children}
        </div>
        <div style={{ flexShrink: 0 }}>{actions}</div>
      </div>
    );
  };

  return (
    <AppShell current="tickets">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="Patient messages"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 280, maxWidth: '100%', height: 14 }} />
            : `${open.length} awaiting a reply · ${resolved.length} resolved`}
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Patient messages' }]}
        />

        {error ? (
          <div className="card">
            <ErrorState title="Could not load tickets" message={error} onRetry={() => setRetryKey((k) => k + 1)} />
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h2 className="h-section">Open</h2></div>
              <div>
                {loading ? rowSkeletons(2) : open.length === 0 ? (
                  <div style={{ padding: '8px 20px 16px' }}>
                    <EmptyState
                      icon="inbox"
                      title="No open messages"
                      message="Messages sent from the patient portal's Help & support page appear here."
                    />
                  </div>
                ) : open.map((t) => (
                  <TicketRow
                    key={t.id}
                    t={t}
                    actions={<button className="btn btn-primary sm" onClick={() => startReply(t)}><Icon name="reply" size={13} /> Reply</button>}
                  />
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="h-section">Resolved</h2></div>
              <div>
                {loading ? rowSkeletons(1) : resolved.length === 0 ? (
                  <div style={{ padding: '8px 20px 16px' }}>
                    <EmptyState icon="check-circle-2" title="Nothing resolved yet" message="Replied messages move here." />
                  </div>
                ) : resolved.map((t) => {
                  const staffMsgs = (threads[t.id] || []).filter((m) => m.sender === 'staff');
                  const lastReply = staffMsgs.length > 0 ? staffMsgs[staffMsgs.length - 1] : null;
                  return (
                    <TicketRow
                      key={t.id}
                      t={t}
                      actions={<Badge kind="success" dot={false}>Replied</Badge>}
                    >
                      {lastReply && (
                        <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, background: 'var(--success-soft)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '8px 10px', color: 'var(--success-text)' }}>
                          <strong>Our reply:</strong> {lastReply.body}
                        </div>
                      )}
                    </TicketRow>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!replyFor}
        onClose={() => setReplyFor(null)}
        title="Reply to patient"
        subtitle={replyFor ? `${replyFor.patient?.full_name || 'Patient'} · "${replyFor.subject || 'Support ticket'}"` : ''}
        icon="reply"
        iconKind="info"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setReplyFor(null)} disabled={sending}>Cancel</button>
          <button className={`btn btn-primary ${sending ? 'btn-loading' : ''}`} onClick={sendReply} disabled={sending}>Send reply &amp; resolve</button>
        </>}
      >
        {replyFor && (() => {
          const msgs = threads[replyFor.id] || [];
          const patientMsgs = msgs.filter((m) => m.sender === 'patient');
          const original = patientMsgs[0];
          // Conversation history: everything except the original message,
          // kept in chronological order
          const history = original ? msgs.filter((m) => m.id !== original.id) : msgs;
          return (
            <div className="stack md">
              <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 13, lineHeight: 1.55 }}>
                {original?.body || ''}
              </div>
              {history.map((m) => (
                <div key={m.id} style={{
                  borderRadius: 6, padding: '8px 10px', fontSize: 12.5, lineHeight: 1.55,
                  border: '1px solid ' + (m.sender === 'staff' ? 'var(--success-border)' : 'var(--border)'),
                  background: m.sender === 'staff' ? 'var(--success-soft)' : 'var(--surface-muted)',
                  color: m.sender === 'staff' ? 'var(--success-text)' : 'var(--text-secondary)',
                }}>
                  <strong>{m.sender === 'staff' ? 'Previous staff reply' : 'Patient follow-up'}:</strong> {m.body}
                  {m.created_at && <div className="t-help" style={{ marginTop: 2 }}>{formatDate(m.created_at.slice(0, 10))}</div>}
                </div>
              ))}
              <Field
                label="Your reply"
                required
                error={replyError}
                help="The patient sees this in their portal; sending also marks the message resolved."
              >
                <TextArea
                  rows={4}
                  value={replyText}
                  onChange={(e) => { setReplyText(e.target.value); if (replyError) setReplyError(''); }}
                  error={replyError}
                  maxLength={500}
                  placeholder="e.g., Your HMO covers the annual physical exam. Just present your card at the counter."
                />
              </Field>
            </div>
          );
        })()}
      </Modal>
    </AppShell>
  );
}

export { TicketsMgmt };
