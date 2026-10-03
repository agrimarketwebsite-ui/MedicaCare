// AppointmentHistory — patient (Phase 4: wired to the backend API)
// GET /api/appointments → table with status filter, search, sorting, at
// pagination. Cancel via POST /api/appointments/:id/cancel; "Rate your visit"
// opens the shared RatingModal for completed visits not yet rated.
import { useEffect, useState } from 'react';
import { AppShell, ConfirmModal, DoctorAvatar, EmptyState, ErrorState, Icon, navigate, PageHeader, Pagination, SelectInput, SortableTh, StatusBadge, useHashRoute, useStore } from '../shared/components.jsx';
import { cancelAppointment, getAppointments } from '../shared/api.js';
import { time24Value, toFrontendAppt } from './helpers.js';

import { RatingModal } from './RatingModal.jsx';
import { syncListParams } from './helpers.js';

function AppointmentHistory() {
  const store = useStore();
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // §50 URL state: status / q / page are reflected in the URL so a filtered
  // history view survives a refresh and can be deep-linked (same pattern as
  // the admin Appointments ?status= link from the dashboard)
  const route = useHashRoute();
  const [, historyQuery] = route.split('?');
  const linkParams = new URLSearchParams(historyQuery || '');
  const linkStatus = linkParams.get('status');
  const [status, setStatus] = useState(
    ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'].includes(linkStatus) ? linkStatus : 'all'
  );
  const [query, setQuery] = useState(linkParams.get('q') || '');
  const [page, setPage] = useState(() => {
    const p = parseInt(linkParams.get('page'), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  // Write the visible state back to the URL. replaceState adds no history
  // entry and fires no hashchange, so the back button keeps behaving like
  // navigation between pages, not between filter clicks.
  useEffect(() => {
    syncListParams('/patient/history', {
      ...(status !== 'all' ? { status } : {}),
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    });
  }, [status, query, page]);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  // Rate-your-visit modal: completed appointments only, one rating per
  // appointment (the action is hidden once a rating exists — tracked locally
  // after a successful POST, enforced server-side with 409)
  const [rateAppt, setRateAppt] = useState(null);
  const hasRated = (apptId) => (store.ratings || []).some(r => r.appointmentId === apptId);
  // The API `rated` flag is the source of truth (cross-device); the local
  // record only covers a rating made on this device/session.
  const isRated = (a) => Boolean(a.rated) || hasRated(a.id);
  // Column sorting (guideline 18) — default stays newest-first by date
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const PAGE = 4;

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const list = await getAppointments();
      setAppts((list || []).map(toFrontendAppt).filter(Boolean));
    } catch (err) {
      setLoadError(err.message || 'Could not load the appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getAppointments()
      .then((list) => { if (!cancelled) setAppts((list || []).map(toFrontendAppt).filter(Boolean)); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load the appointments.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = appts.filter(a => {
    if (status !== 'all' && a.status !== status) return false;
    if (query) {
      const hay = (a.doctorName + ' ' + a.specialty + ' ' + (a.reason || '')).toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc'); }
  };
  const sortVal = (a) => {
    switch (sortKey) {
      case 'doctor': return (a.doctorName || '').toLowerCase();
      case 'specialty': return (a.specialty || '').toLowerCase();
      case 'time': return time24Value(a.time);
      case 'status': return a.status;
      default: return a.date;
    }
  };
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = filtered.slice().sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b);
    if (va !== vb) return (va < vb ? -1 : 1) * dir;
    // Tie-breaker: equal values keep newest-first date order, then true time order
    return b.date.localeCompare(a.date) || time24Value(a.time) - time24Value(b.time);
  });

  const paged = sorted.slice((page - 1) * PAGE, page * PAGE);
  // A sort change can move the current page out of range
  useEffect(() => { setPage(1); }, [sortKey, sortDir]);
  // A stale ?page= from an old URL can point past the current result set
  useEffect(() => {
    const last = Math.max(1, Math.ceil(filtered.length / PAGE));
    if (page > last) setPage(last);
  }, [filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const doCancel = async () => {
    setCancelLoading(true);
    try {
      await cancelAppointment(confirmCancel.id);
      store.pushToast({ title: 'Appointment cancelled', msg: 'Your appointment has been cancelled successfully.' });
      setConfirmCancel(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not cancel', msg: err.message || 'Please try again.' });
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <AppShell current="history">
      <div className="page">
        <PageHeader
          title="My appointments"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 200, maxWidth: '100%', height: 14 }} />
            : `${appts.length} appointments in total`}
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Appointments' }]}
          actions={<button className="btn btn-primary" onClick={() => navigate('/patient/book')}><Icon name="calendar-plus" size={14} /> Book appointment</button>}
        />

        {loadError ? (
          <div className="card"><ErrorState title="Couldn't load the appointments" message={loadError} onRetry={load} /></div>
        ) : (
        <div className="card">
          <div className="table-toolbar">
            <div className="input-group search">
              <Icon name="search" size={16} className="input-icon" />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search doctor, specialty, or reason…" aria-label="Search appointments by doctor, specialty, or reason" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <SelectInput
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              aria-label="Filter appointments by status"
              style={{ maxWidth: 190 }}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No-show</option>
            </SelectInput>
          </div>

          {!loading && filtered.length === 0 ? (
            <EmptyState icon="calendar-search" title="No appointments match your filters"
              message="Try changing your filters or search terms."
              actions={<button className="btn btn-secondary" onClick={() => { setQuery(''); setStatus('all'); }}>Clear filters</button>} />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table table-responsive-stack">
                  <thead>
                    <tr>
                      <SortableTh label="Doctor" k="doctor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Specialty" k="specialty" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Time" k="time" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      // Skeleton rows mirroring the real ones: the Doctor cell has
                      // an avatar + Ref line like the loaded rows, and every cell
                      // carries data-label so the mobile stacked-card view renders
                      // with labels (plain <SkeletonRows/> bars ignore that layout)
                      Array.from({ length: 4 }).map((_, r) => (
                        <tr key={r}>
                          <td data-label="Doctor">
                            <div className="cell-with-avatar">
                              <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <span className="skel" style={{ width: 120, maxWidth: '100%', height: 12, display: 'block' }} />
                                <span className="skel" style={{ width: 70, height: 10, display: 'block', marginTop: 5 }} />
                              </div>
                            </div>
                          </td>
                          <td data-label="Specialty"><span className="skel" style={{ width: '70%', height: 12 }} /></td>
                          <td data-label="Date"><span className="skel" style={{ width: '70%', height: 12 }} /></td>
                          <td data-label="Time"><span className="skel" style={{ width: '60%', height: 12 }} /></td>
                          <td data-label="Status"><span className="skel" style={{ width: 64, height: 18 }} /></td>
                          <td className="col-actions" data-label="Actions">
                            <div className="appt-actions">
                              <span className="skel" style={{ flex: 1, maxWidth: 88, height: 30 }} />
                              <span className="skel" style={{ flex: 1, maxWidth: 64, height: 30 }} />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : paged.map(a => {
                      const d = (store.doctors || []).find(x => x.id === a.doctorId) || { name: a.doctorName, specialty: a.specialty };
                      const cancellable = a.status === 'pending' || a.status === 'confirmed';
                      return (
                        <tr key={a.id}>
                          <td>
                            <div className="cell-with-avatar">
                              <DoctorAvatar doctor={d} size={28} />
                              <div>
                                <div className="cell-primary cell-primary-truncate">{a.doctorName}</div>
                                <div className="cell-secondary">Ref {a.reference}</div>
                              </div>
                            </div>
                          </td>
                          <td data-label="Specialty">{a.specialty}</td>
                          <td data-label="Date">{window.formatDate(a.date)}</td>
                          <td data-label="Time">{a.timeDisplay}</td>
                          <td data-label="Status"><StatusBadge status={a.status} /></td>
                          <td className="col-actions" data-label="Actions">
                            <div className="appt-actions">
                              <button className="btn btn-ghost sm" onClick={() => navigate('/patient/appointment/' + a.id)}>View details</button>
                              {a.status === 'completed' && !isRated(a) && (
                                <button className="btn btn-primary sm" onClick={() => setRateAppt(a)}><Icon name="star" size={13} /> Rate visit</button>
                              )}
                              {cancellable && (
                                <button className="btn btn-danger-outline sm" onClick={() => setConfirmCancel(a)}>Cancel</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!loading && filtered.length > 0 && (
                <Pagination page={page} setPage={setPage} total={filtered.length} pageSize={PAGE} label="appointments" />
              )}
            </>
          )}
        </div>
        )}
      </div>

      <RatingModal open={!!rateAppt} appointment={rateAppt} onClose={() => setRateAppt(null)} />

      <ConfirmModal
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={doCancel}
        loading={cancelLoading}
        title="Cancel this appointment?"
        message={confirmCancel ? `${confirmCancel.doctorName} on ${window.formatDate(confirmCancel.date)} at ${confirmCancel.timeDisplay}. This action cannot be undone.` : ''}
        confirmLabel="Yes, cancel it"
        kind="danger"
      />
    </AppShell>
  );
}

export { AppointmentHistory };
