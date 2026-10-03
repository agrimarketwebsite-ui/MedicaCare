// DoctorDashboard — doctor portal
// Today's schedule: each appointment has Complete visit / No-show actions
// (pending/confirmed only), and Notes for completed. Data comes from the
// API — not the seed store.
import { useEffect, useState } from 'react';
import { AppShell, ConfirmModal, DoctorStatusBadge, EmptyState, ErrorState, Icon, navigate, PageHeader, PatientAvatar, StatusBadge, useStore } from '../shared/components.jsx';
import { formatDate, formatDateLong, formatDayRange } from '../shared/data.js';
import { api, getDoctorAvailability, getDoctorToday, markNoShow, ApiError } from '../shared/api.js';
import { fmtTime12, localToday, useDoctor } from './helpers.js';
import { CompleteVisitModal } from './CompleteVisitModal.jsx';
import { PatientHistoryModal } from './PatientHistoryModal.jsx';
import { VisitNotesModal } from './VisitNotesModal.jsx';

const WD_TO_SHORT = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

function DoctorDashboard() {
  const store = useStore();
  const me = useDoctor();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(localToday());
  const [todayAppts, setTodayAppts] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [clinicDays, setClinicDays] = useState(null);
  const [completeAppt, setCompleteAppt] = useState(null);
  const [historyPatient, setHistoryPatient] = useState(null);
  const [notesAppt, setNotesAppt] = useState(null);
  // No-show is consequential (marks the record and frees the slot), so it
  // gets a confirmation instead of firing straight from the row
  const [confirmNoShow, setConfirmNoShow] = useState(null);
  const [acting, setActing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const todayStr = localToday();
    // Day after today for the upcoming list
    const d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const pad = (x) => String(x).padStart(2, '0');
    const tomorrow = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    Promise.all([
      getDoctorToday(),
      api(`/doctor/appointments?from=${tomorrow}`).then((r) => r.appointments || []),
      getDoctorAvailability().catch(() => []),
    ])
      .then(([todayData, upcomingList, avail]) => {
        if (cancelled) return;
        setDate(todayData.date || todayStr);
        const sorted = (todayData.appointments || []).slice()
          .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
        setTodayAppts(sorted);
        setUpcoming(upcomingList
          .filter(a => a.status === 'pending' || a.status === 'confirmed')
          .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)) || String(a.start_time).localeCompare(String(b.start_time))));
        const days = [...new Set((avail || []).map(e => WD_TO_SHORT[e.weekday]).filter(Boolean))];
        setClinicDays(days.length ? formatDayRange(days) : null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Could not load today's schedule.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  const doneToday = todayAppts.filter(a => a.status === 'completed').length;

  const doNoShow = async () => {
    if (!confirmNoShow) return;
    setActing(true);
    try {
      const updated = await markNoShow(confirmNoShow.id);
      setTodayAppts(list => list.map(a => (a.id === updated.id ? { ...a, status: updated.status } : a)));
      store.pushToast({ title: 'Marked as no-show', msg: 'The time slot is now free for other patients.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not mark as no-show', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setActing(false);
      setConfirmNoShow(null);
    }
  };

  const onCompleted = (result) => {
    const updated = result.appointment || result;
    setTodayAppts(list => list.map(a => (a.id === updated.id ? { ...a, ...updated } : a)));
    setCompleteAppt(null);
  };

  const stats = [
    // Distinct icon per stat — three identical calendar icons read as template
    // filler, not as three different numbers
    { icon: 'calendar-days', label: "Today's appointments", value: todayAppts.length, context: formatDateLong(date) },
    { icon: 'check-circle-2', label: 'Completed today', value: doneToday, context: `${todayAppts.length - doneToday} still to see` },
    { icon: 'calendar-clock', label: 'Upcoming', value: upcoming.length, context: 'Pending & confirmed visits ahead' },
  ];

  const renderApptRow = (a, showDate) => {
    const patientName = a.patient?.full_name || a.booked_for || 'Unknown patient';
    const canComplete = a.status === 'pending' || a.status === 'confirmed';
    return (
      <div key={a.id} className="list-item">
        <span className="t-mono" style={{ fontSize: 13, fontWeight: 600, width: showDate ? 130 : 72, flexShrink: 0 }}>
          {showDate ? <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{formatDate(a.appointment_date)} · </span> : null}
          {fmtTime12(a.start_time)}
        </span>
        <PatientAvatar person={{ name: patientName }} size={32} />
        <div className="list-item-body">
          <div className="list-item-title">
            {/* Patient name opens the shared-chart history */}
            <button type="button" className="link-btn" onClick={() => setHistoryPatient(a.patient || { id: a.patient?.id, full_name: patientName })}>
              {patientName}
            </button>
            {a.booked_for && a.patient?.full_name && a.booked_for !== a.patient.full_name && (
              <span className="t-muted" style={{ fontWeight: 400 }}> · booking for {a.booked_for}</span>
            )}
          </div>
          <div className="list-item-sub">{a.reason || '—'}</div>
        </div>
        <StatusBadge status={a.status} />
        {canComplete && (
          <>
            {/* Quiet ghost action — the old red icon read as delete;
                no-show is a status report, not a destructive act */}
            <button className="btn btn-ghost sm" title="Patient did not arrive" onClick={() => setConfirmNoShow(a)}>
              <Icon name="user-x" size={13} /> No-show
            </button>
            <button className="btn btn-primary sm" onClick={() => setCompleteAppt(a)}>Complete visit</button>
          </>
        )}
        {a.status === 'completed' && (
          <button className="btn btn-ghost sm" onClick={() => setNotesAppt(a)}>Notes</button>
        )}
      </div>
    );
  };

  return (
    <AppShell current="d-dashboard">
      <div className="page">
        <PageHeader
          title={loading
            ? /* Skeleton for the doctor's name — the live record loads from
                 the store alongside the rest of the page (same 600ms window) */
              <span className="skel" aria-hidden="true" style={{ display: 'inline-block', width: 280, maxWidth: '100%', height: 24, verticalAlign: 'middle' }} />
            : me.name}
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 260, maxWidth: '100%', height: 14 }} />
            : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{me.specialty} · {me.room}</span>
                {clinicDays && <span>Clinic days: {clinicDays}</span>}
                <DoctorStatusBadge status={me.status} />
              </span>
            )}
          breadcrumbs={[{ label: 'Doctor portal' }]}
          actions={<button className="btn btn-secondary" onClick={() => navigate('/doctor/patients')}>All my patients <Icon name="arrow-right" size={13} /></button>}
        />

        <div className="stat-grid three" style={{ marginBottom: 20 }}>
          {stats.map((s, i) => (
            <div key={i} className="card stat-card">
              {loading ? (
                <>
                  <span className="skel" style={{ height: 12, width: '70%' }} />
                  <span className="skel" style={{ height: 26, width: '30%' }} />
                  <span className="skel" style={{ height: 10, width: '55%' }} />
                </>
              ) : (
                <>
                  <div className="stat-label"><Icon name={s.icon} size={14} /> {s.label}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-delta">{s.context}</div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2 className="h-section">Today's schedule</h2>
            <span className="t-muted" style={{ fontSize: 12 }}>{formatDateLong(date)}</span>
          </div>
          <div>
            {loading ? (
              [0, 1, 2].map(i => (
                <div key={i} className="list-item" aria-hidden="true">
                  <span className="skel" style={{ width: 64, height: 12, flexShrink: 0 }} />
                  <span className="skel" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="skel" style={{ height: 11, width: '45%' }} />
                    <span className="skel" style={{ height: 10, width: '70%' }} />
                  </div>
                  <span className="skel" style={{ width: 84, height: 28, flexShrink: 0 }} />
                </div>
              ))
            ) : error ? (
              <div style={{ padding: '8px 20px 16px' }}>
                <ErrorState title="Could not load schedule" message={error} onRetry={() => setRetryKey(k => k + 1)} />
              </div>
            ) : todayAppts.length === 0 ? (
              <div style={{ padding: '8px 20px 16px' }}>
                <EmptyState icon="calendar-check" title="No appointments today" message="Your schedule is clear. Enjoy the breather." />
              </div>
            ) : todayAppts.map(a => renderApptRow(a, false))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="h-section">Coming up</h2>
            <button className="btn btn-ghost sm" onClick={() => navigate('/doctor/patients')}>See all <Icon name="arrow-right" size={13} /></button>
          </div>
          <div>
            {loading ? (
              [0, 1].map(i => (
                <div key={i} className="list-item" aria-hidden="true">
                  <span className="skel" style={{ width: 130, height: 12, flexShrink: 0 }} />
                  <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="skel" style={{ height: 11, width: '40%' }} />
                    <span className="skel" style={{ height: 10, width: '60%' }} />
                  </div>
                </div>
              ))
            ) : upcoming.length === 0 ? (
              <div style={{ padding: '8px 20px 16px' }}>
                <EmptyState icon="calendar" title="Nothing scheduled ahead" message="New bookings from the portal will appear here." />
              </div>
            ) : upcoming.slice(0, 4).map(a => renderApptRow(a, true))}
          </div>
        </div>
      </div>

      <CompleteVisitModal appointment={completeAppt} onClose={() => setCompleteAppt(null)} onCompleted={onCompleted} />
      <PatientHistoryModal patient={historyPatient} onClose={() => setHistoryPatient(null)} />
      <VisitNotesModal appointment={notesAppt} onClose={() => setNotesAppt(null)} />

      <ConfirmModal
        open={!!confirmNoShow}
        onClose={() => setConfirmNoShow(null)}
        onConfirm={doNoShow}
        title="Mark as no-show?"
        message={confirmNoShow ? `${confirmNoShow.patient?.full_name || 'This patient'} will be marked as a no-show for ${formatDate(confirmNoShow.appointment_date)} at ${fmtTime12(confirmNoShow.start_time)}, and the time slot will be freed for rebooking.` : ''}
        confirmLabel="Mark no-show"
        kind="danger"
        loading={acting}
      />
    </AppShell>
  );
}

export { DoctorDashboard };
export default DoctorDashboard;
