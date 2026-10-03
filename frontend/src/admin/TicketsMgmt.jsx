// TicketsMgmt — support tickets (Phase 6).
// List (open/resolved filter) + thread view + reply box + resolve button.
// Ticket shape: { id, subject, status, patient: { full_name }, created_at,
//   messages: [{ id, sender, body, created_at }] }.
import { useEffect, useState } from 'react';
import {
  AppShell, Badge, EmptyState, ErrorState, Icon, PageHeader,
  SelectInput, SkeletonRows, TextArea, useStore,
} from '../shared/components.jsx';
import { getAdminTicket, getAdminTickets, replyTicket, resolveTicket, ApiError } from '../shared/api.js';

function TicketsMgmt() {
  const store = useStore();
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getAdminTickets(status);
      setTickets(list);
      if (list.length > 0 && !list.some((t) => t.id === selectedId)) {
        setSelectedId(list[0].id);
      } else if (list.length === 0) {
        setSelectedId(null);
        setThread(null);
      }
    } catch (err) {
      setError(err.message || 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setThread(null); return; }
    let cancelled = false;
    setThreadLoading(true);
    setReply('');
    getAdminTicket(selectedId)
      .then((t) => { if (!cancelled) setThread(t); })
      .catch((err) => {
        if (!cancelled) store.pushToast({ kind: 'error', title: 'Could not load ticket', message: err.message });
      })
      .finally(() => { if (!cancelled) setThreadLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doReply = async () => {
    if (!reply.trim() || !selectedId) return;
    setBusy(true);
    try {
      await replyTicket(selectedId, { body: reply.trim() });
      const t = await getAdminTicket(selectedId);
      setThread(t);
      setReply('');
      store.pushToast({ kind: 'success', title: 'Reply sent', message: 'Your reply was added to the ticket.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Reply failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const doResolve = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const updated = await resolveTicket(selectedId);
      store.pushToast({ kind: 'success', title: 'Ticket resolved', message: 'The ticket was marked as resolved.' });
      setTickets((prev) => prev.map((t) => (t.id === selectedId ? updated : t)));
      setThread(updated);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Action failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const messages = thread?.messages || [];

  return (
    <AppShell current="tickets">
      <div className="page">
        <PageHeader
          title="Patient messages"
          subtitle="Support tickets from patients."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Patient messages' }]}
        />

        <div className="card">
          <div className="table-toolbar">
            <SelectInput
              value={status}
              onChange={(e) => { setStatus(e.target.value); setSelectedId(null); }}
              aria-label="Filter tickets by status"
              style={{ maxWidth: 190 }}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="">All</option>
            </SelectInput>
          </div>

          {loading ? (
            <table className="table" aria-hidden="true">
              <tbody><SkeletonRows rows={6} cols={4} /></tbody>
            </table>
          ) : error ? (
            <ErrorState title="Could not load tickets" message={error} onRetry={load} />
          ) : tickets.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No tickets found"
              message={status === 'open' ? 'There are no open tickets. Nice.' : 'Try a different status filter.'}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 0 }}>
              {/* ---------- list ---------- */}
              <div style={{ borderRight: '1px solid var(--border)' }}>
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="ticket-row"
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                      background: t.id === selectedId ? 'var(--surface-muted)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.subject || 'Support ticket'}</div>
                    <div className="t-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {t.patient?.full_name || '—'} · {(t.created_at || '').slice(0, 10)}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Badge kind={t.status === 'open' ? 'danger' : 'success'}>{t.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              {/* ---------- thread ---------- */}
              <div style={{ padding: 16 }}>
                {threadLoading ? (
                  <div className="t-muted" style={{ textAlign: 'center', padding: 32 }}>Loading thread…</div>
                ) : !thread ? (
                  <EmptyState icon="message-circle" title="Select a ticket" message="Choose a ticket on the left to read its thread." />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ margin: 0 }}>{thread.subject || 'Support ticket'}</h3>
                      {thread.status === 'open' && (
                        <button className="btn btn-secondary sm" onClick={doResolve} disabled={busy}>
                          <Icon name="check" size={14} /> Resolve
                        </button>
                      )}
                    </div>
                    <div className="thread" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                      {messages.length === 0 && (
                        <div className="t-muted" style={{ fontSize: 13 }}>No messages yet.</div>
                      )}
                      {messages.map((m) => {
                        const mine = m.sender === 'admin' || m.sender_role === 'admin';
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: mine ? 'flex-end' : 'flex-start',
                              maxWidth: '80%',
                              background: mine ? 'var(--primary)' : 'var(--surface-muted)',
                              color: mine ? '#fff' : 'var(--text)',
                              borderRadius: 10,
                              padding: '8px 12px',
                              fontSize: 13.5,
                            }}
                          >
                            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
                              {(m.sender || 'patient')} · {(m.created_at || '').slice(0, 16).replace('T', ' ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {thread.status === 'open' ? (
                      <div>
                        <TextArea
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          rows={3}
                          placeholder="Write a reply…"
                          aria-label="Reply to ticket"
                        />
                        <div style={{ marginTop: 8, textAlign: 'right' }}>
                          <button className="btn btn-primary sm" onClick={doReply} disabled={busy || !reply.trim()}>
                            {busy ? 'Sending…' : 'Send reply'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="t-muted" style={{ fontSize: 13 }}>
                        <Icon name="check-circle" size={13} /> This ticket is resolved.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export { TicketsMgmt };
