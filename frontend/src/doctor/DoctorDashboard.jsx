// DoctorDashboard — doctor (Phase 5)
// Today's schedule (Manila): bawat appointment ay may Complete visit /
// No-show actions (pending/confirmed lang), at View notes para sa completed.
// Ang data ay galing sa API — hindi sa seed store.
import { useEffect, useState } from 'react';
import { AppShell, ConfirmModal, EmptyState, ErrorState, Icon, PageHeader, StatusBadge, useStore } from '../shared/components.jsx';
import { getDoctorToday, markNoShow, ApiError } from '../shared/api.js';
import { fmtDateLong, fmtTime12, localToday } from './helpers.js';
import { CompleteVisitModal } from './CompleteVisitModal.jsx';
import { VisitNotesModal } from './VisitNotesModal.jsx';

const MUTABLE = new Set(['pending', 'confirmed']);

// Status accent para sa schedule-style rows — tugma sa StatusBadge semantics
// (pending=amber, confirmed=blue, completed=green, cancelled=gray, no-show=red).
const STATUS_ACCENT = {
  pending: '#d97706',
  confirmed: 'var(--primary)',
  completed: '#059669',
  cancelled: '#9ca3af',
  'no-show': '#dc2626',
};

function DoctorDashboard() {
  const store = useStore();
  // Ang session name ay email (mula sa DoctorLogin) — gamitin ang directory
  // record para sa tunay na pangalan, tulad ng sidebar (layout.jsx).
  const doctorRec = (typeof window !== 'undefined' && window.findDoctor && store.doctorSession?.doctorId)
    ? window.findDoctor(store.doctorSession.doctorId)
    : null;
  const doctorName = doctorRec?.name || store.doctorSession?.name || store.doctorSession?.email || 'Doctor';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(localToday());
  const [appointments, setAppointments] = useState([]);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [notesTargetId, setNotesTargetId] = useState(null);
  const [noShowTarget, setNoShowTarget] = useState(null);
  const [acting, setActing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const load = () => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDoctorToday()
      .then((d) => {
        if (cancelled) return;
        setDate(d.date || localToday());
        setAppointments(d.appointments || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load today\'s schedule.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  };

  useEffect(load, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const doNoShow = async () => {
    if (!noShowTarget) return;
    setActing(true);
    try {
      const updated = await markNoShow(noShowTarget.id);
      setAppointments(list => list.map(a => (a.id === updated.id ? { ...a, status: updated.status } : a)));
      store.pushToast({ title: 'Marked as no-show', msg: 'The time slot is now free for other patients.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not mark as no-show', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setActing(false);
      setNoShowTarget(null);
    }
  };

  const onCompleted = (result) => {
    const updated = result.appointment;
    setAppointments(list => list.map(a => (a.id === updated.id ? { ...a, ...updated } : a)));
  };

  const upcoming = appointments.filter(a => MUTABLE.has(a.status));
  const done = appointments.filter(a => !MUTABLE.has(a.status));

  return (
    <AppShell current="d-dashboard">
      <div className="page">
        <PageHeader
          title={`Good day, ${doctorName}`}
          subtitle={`Today's schedule — ${fmtDateLong(date)}`}
          breadcrumbs={[{ label: 'Home', to: '/doctor' }, { label: "Today's schedule" }]}
        />

        <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Appointments today', value: appointments.length, icon: 'calendar-days', accent: 'var(--primary)', soft: 'var(--primary-soft)' },
            { label: 'Up next', value: upcoming.length, icon: 'clock', accent: '#d97706', soft: '#fef3c7' },
            { label: 'Completed', value: done.filter(a => a.status === 'completed').length, icon: 'check-circle', accent: '#059669', soft: '#d1fae5' },
          ].map(s => (
            <div key={s.label} className="card" style={{ borderTop: `3px solid ${s.accent}` }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: s.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={s.icon} size={22} style={{ color: s.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>
                    {loading
                      ? <span className="skel" aria-hidden="true" style={{ width: 30, height: 26, display: 'inline-block', verticalAlign: 'middle' }} />
                      : s.value}
                  </div>
                  <div className="t-muted" style={{ fontSize: 12.5 }}>{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header"><h2 className="h-section">Today's appointments</h2></div>
          <div className="card-body">
            {loading ? (
              <div className="stack md" aria-hidden="true">
                {[0, 1, 2].map(i => (
                  <div key={i} className="card" style={{ background: 'var(--surface)', borderLeft: '4px solid var(--border)' }}>
                    <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 92 }}>
                        <span className="skel" style={{ width: 64, height: 15, display: 'block', marginBottom: 5 }} />
                        <span className="skel" style={{ width: 52, height: 11, display: 'block' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <span className="skel" style={{ width: '45%', height: 14, display: 'block', marginBottom: 6 }} />
                        <span className="skel" style={{ width: '70%', height: 11, display: 'block', marginBottom: 5 }} />
                        <span className="skel" style={{ width: '30%', height: 11, display: 'block' }} />
                      </div>
                      <span className="skel" style={{ width: 76, height: 22, borderRadius: 999 }} />
                      <span className="skel" style={{ width: 128, height: 32, borderRadius: 8 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <ErrorState title="Could not load schedule" message={error} onRetry={() => setRetryKey(k => k + 1)} />
            ) : appointments.length === 0 ? (
              <EmptyState icon="calendar-check" title="No appointments today" message="Enjoy the quiet day — new bookings will appear here." />
            ) : (
              <div className="stack md">
                {appointments
                  .slice()
                  .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
                  .map(a => {
                    const patientName = a.patient?.full_name || a.booked_for || 'Patient';
                    const actionable = MUTABLE.has(a.status);
                    const accent = STATUS_ACCENT[a.status] || '#9ca3af';
                    return (
                      <div key={a.id} className="card" style={{ background: 'var(--surface)', borderLeft: `4px solid ${accent}` }}>
                        <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 92 }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: accent }}>{fmtTime12(a.start_time)}</div>
                            <div className="t-muted" style={{ fontSize: 12 }}>to {fmtTime12(a.end_time)}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <div style={{ fontWeight: 700 }}>{patientName}</div>
                            <div className="t-muted" style={{ fontSize: 12.5 }}>
                              {a.booked_for ? `Booked for ${a.booked_for} · ` : ''}{a.reason || '—'}
                            </div>
                            <div className="t-muted" style={{ fontSize: 12 }}>Ref {a.reference_code}</div>
                          </div>
                          <StatusBadge status={a.status} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            {actionable ? (
                              <>
                                <button className="btn btn-primary sm" onClick={() => setCompleteTarget(a)}>
                                  <Icon name="clipboard-check" size={14} /> Complete visit
                                </button>
                                <button className="btn btn-ghost sm" onClick={() => setNoShowTarget(a)}>
                                  No-show
                                </button>
                              </>
                            ) : a.status === 'completed' ? (
                              <button className="btn btn-secondary sm" onClick={() => setNotesTargetId(a.id)}>
                                <Icon name="file-text" size={14} /> View notes
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      <CompleteVisitModal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        appointment={completeTarget}
        onCompleted={onCompleted}
      />

      <VisitNotesModal
        open={!!notesTargetId}
        onClose={() => setNotesTargetId(null)}
        appointmentId={notesTargetId}
      />

      <ConfirmModal
        open={!!noShowTarget}
        onClose={() => setNoShowTarget(null)}
        title="Mark as no-show?"
        message={`Mark ${noShowTarget?.patient?.full_name || 'this patient'} as no-show? The time slot will be freed for other patients.`}
        confirmLabel="Mark no-show"
        onConfirm={doNoShow}
        loading={acting}
      />
    </AppShell>
  );
}

export { DoctorDashboard };
export default DoctorDashboard;
