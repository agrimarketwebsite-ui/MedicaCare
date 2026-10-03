// DoctorPatients — doctor portal
// My patients: all appointments with this doctor (table with status
// filters and per-row actions). Patient name opens the shared-chart
// history modal.
import { useEffect, useState } from 'react';
import { AppShell, ConfirmModal, EmptyState, ErrorState, Icon, navigate, PageHeader, PatientAvatar, StatusBadge, useStore } from '../shared/components.jsx';
import { api, markNoShow, ApiError } from '../shared/api.js';
import { fmtTime12, localToday } from './helpers.js';
import { formatDate } from '../shared/data.js';
import { CompleteVisitModal } from './CompleteVisitModal.jsx';
import { PatientHistoryModal } from './PatientHistoryModal.jsx';
import { VisitNotesModal } from './VisitNotesModal.jsx';

function DoctorPatients() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [completeAppt, setCompleteAppt] = useState(null);
  const [viewNotes, setViewNotes] = useState(null);
  const [historyPatient, setHistoryPatient] = useState(null);
  // No-show is consequential (marks the record and frees the slot), so it
  // gets a confirmation instead of firing straight from the row
  const [confirmNoShow, setConfirmNoShow] = useState(null);
  const [acting, setActing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api('/doctor/appointments')
      .then((d) => {
        if (cancelled) return;
        setAppointments(d.appointments || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load appointments.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  const today = localToday();
  const q = query.trim().toLowerCase();
  const filtered = appointments
    .filter(a => {
      if (q) {
        const hay = ((a.patient?.full_name || '') + ' ' + (a.reason || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === 'today') return a.appointment_date === today;
      if (filter === 'upcoming') return a.appointment_date > today && (a.status === 'pending' || a.status === 'confirmed');
      if (filter === 'completed') return a.status === 'completed';
      if (filter === 'no-show') return a.status === 'no-show';
      return true;
    })
    .sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date)) || String(b.start_time).localeCompare(String(a.start_time)));

  const filters = [
    ['all', 'All'],
    ['today', 'Today'],
    ['upcoming', 'Upcoming'],
    ['completed', 'Completed'],
    ['no-show', 'No-show'],
  ];

  const doNoShow = async () => {
    if (!confirmNoShow) return;
    setActing(true);
    try {
      const updated = await markNoShow(confirmNoShow.id);
      setAppointments(list => list.map(a => (a.id === updated.id ? { ...a, status: updated.status } : a)));
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
    setAppointments(list => list.map(a => (a.id === updated.id ? { ...a, ...updated } : a)));
    setCompleteAppt(null);
  };

  return (
    <AppShell current="d-patients">
      <div className="page">
        <PageHeader
          title="My patients"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 220, maxWidth: '100%', height: 14 }} />
            : `${filtered.length} appointment${filtered.length === 1 ? '' : 's'}${filter === 'all' ? ' in total' : ''}`}
          breadcrumbs={[{ label: 'Doctor portal', to: '/doctor/dashboard' }, { label: 'My patients' }]}
          actions={<button className="btn btn-secondary" onClick={() => navigate('/doctor/dashboard')}><Icon name="calendar-check" size={14} /> Today's schedule</button>}
        />

        <div className="card">
          <div className="table-toolbar">
            <div className="input-group search">
              <Icon name="search" size={16} className="input-icon" />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search patient name or reason…" aria-label="Search patients by name or reason" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {filters.map(([key, label]) => (
                <button key={key} className={'chip filter' + (filter === key ? ' on' : '')} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table table-responsive-stack">
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Patient</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, r) => (
                    <tr key={r}>
                      <td data-label="Date & time"><span className="skel" style={{ width: 110, height: 12 }} /></td>
                      <td data-label="Patient">
                        <div className="cell-with-avatar">
                          <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                          <span className="skel" style={{ width: 110, maxWidth: '100%', height: 12 }} />
                        </div>
                      </td>
                      <td data-label="Reason" className="cell-primary-truncate"><span className="skel" style={{ width: '70%', height: 12 }} /></td>
                      <td data-label="Status"><span className="skel" style={{ width: 64, height: 18 }} /></td>
                      <td className="col-actions"><span className="skel" style={{ width: 100, height: 28 }} /></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr><td colSpan={5} className="empty-cell" style={{ padding: 0 }}>
                    <ErrorState title="Could not load appointments" message={error} onRetry={() => setRetryKey(k => k + 1)} />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="empty-cell" style={{ padding: 0 }}>
                    <EmptyState icon="calendar-x" title="No appointments match" message="Try a different filter to see more of your schedule." />
                  </td></tr>
                ) : filtered.map(a => {
                  const patientName = a.patient?.full_name || a.booked_for || 'Unknown patient';
                  const canComplete = a.status === 'pending' || a.status === 'confirmed';
                  return (
                    <tr key={a.id}>
                      <td data-label="Date & time" className="td-nowrap">
                        <div className="cell-primary">{formatDate(a.appointment_date)}</div>
                        <div className="cell-secondary">{fmtTime12(a.start_time)}</div>
                      </td>
                      <td data-label="Patient">
                        <div className="cell-with-avatar">
                          <PatientAvatar person={{ name: patientName }} size={28} />
                          <div>
                            <div className="cell-primary">
                              <button type="button" className="link-btn" onClick={() => setHistoryPatient(a.patient || { id: a.patient?.id, full_name: patientName })}>
                                {patientName}
                              </button>
                            </div>
                            {/* Proxy booking: the visit may be for a family member,
                                not the chart owner — clinically relevant context */}
                            {a.booked_for && a.patient?.full_name && a.booked_for !== a.patient.full_name && (
                              <div className="cell-secondary" style={{ marginTop: 2 }}>Booking for: {a.booked_for}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Full reason is on the title attr — the column truncates */}
                      <td data-label="Reason" className="cell-primary-truncate" style={{ maxWidth: 200 }} title={a.reason}>{a.reason}</td>
                      <td data-label="Status"><StatusBadge status={a.status} /></td>
                      <td className="col-actions">
                        {canComplete ? (
                          <>
                            <button className="btn btn-ghost sm" title="Patient did not arrive" onClick={() => setConfirmNoShow(a)}>
                              <Icon name="user-x" size={13} /> No-show
                            </button>
                            {/* Quieter secondary here: in a long table of equal
                                rows, solid blue per row is visual noise — the
                                solid primary is reserved for Today's schedule,
                                where completing the visit is the page's task */}
                            <button className="btn btn-secondary sm" onClick={() => setCompleteAppt(a)}>Complete visit</button>
                          </>
                        ) : a.status === 'completed' ? (
                          <button className="btn btn-ghost sm" onClick={() => setViewNotes(a)}>View notes</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CompleteVisitModal appointment={completeAppt} onClose={() => setCompleteAppt(null)} onCompleted={onCompleted} />

      {/* Notes view + amend for completed visits; patient name opens the
          shared-chart history */}
      <VisitNotesModal appointment={viewNotes} onClose={() => setViewNotes(null)} />
      <PatientHistoryModal patient={historyPatient} onClose={() => setHistoryPatient(null)} />

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

export { DoctorPatients };
export default DoctorPatients;
