// AppointmentsMgmt — admin appointments (restored prototype UI, real API).
// Live search + status filter + sortable table + inline status select +
// view/edit/create modals + complete-visit notes modal + delete.
import { useEffect, useState } from 'react';
import {
  AppShell, ConfirmModal, EmptyState, ErrorState, Field, Icon, Modal,
  PageHeader, Pagination, PatientAvatar, SelectInput, SortableTh, TextArea,
  useHashRoute, useStore,
} from '../shared/components.jsx';
import { formatDate, statusMeta, timeValue } from '../shared/data.js';
import {
  completeAdminAppointment, deleteAdminAppointment, getAdminAppointments,
  setAdminAppointmentStatus, ApiError,
} from '../shared/api.js';
import { downloadCSV } from './helpers.js';

import { AppointmentDetailsModal, AppointmentEditModal, AppointmentFormModal } from './AppointmentModals.jsx';

const PAGE_SIZE = 15;
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];

// ---------- Appointments Management ----------
function AppointmentsMgmt() {
  const store = useStore();
  const route = useHashRoute();
  // Deep link: /admin/appointments?status=pending (dashboard "See all")
  const [, apptQuery] = route.split('?');
  const linkStatus = new URLSearchParams(apptQuery || '').get('status');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(
    STATUSES.includes(linkStatus) ? linkStatus : 'all'
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [confirmDel, setConfirmDel] = useState(null);
  const [delLoading, setDelLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewAppt, setViewAppt] = useState(null);
  const [editAppt, setEditAppt] = useState(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminAppointments({
        status: status === 'all' ? undefined : status,
        page, limit: PAGE_SIZE,
      });
      setAppointments(r.appointments);
      setTotal(r.total);
    } catch (err) {
      setError(err.message || 'Could not load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const apptDate = (a) => (a.appointment_date || '').slice(0, 10);
  const apptTime = (a) => (a.start_time || '').slice(0, 5);
  const patientName = (a) => a.patient?.full_name || a.booked_for || 'Unknown';
  const doctorName = (a) => a.doctor?.full_name || 'Unknown';
  const doctorSpecialty = (a) => a.doctor?.specialties?.name || '';
  const refOf = (a) => a.reference_code || a.appointment_ref || '';

  const filtered = appointments.filter(a => {
    if (!query) return true;
    const hay = (doctorName(a) + ' ' + patientName(a) + ' ' + (a.reason || '')).toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  // Column sorting; default stays newest-first like before
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc'); }
  };
  const sortVal = (a) => {
    switch (sortKey) {
      case 'ref': return refOf(a);
      case 'patient': return patientName(a).toLowerCase();
      case 'doctor': return doctorName(a).toLowerCase();
      case 'status': return a.status;
      default: return apptDate(a);
    }
  };
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = filtered.slice().sort((a, b) => {
    const va = sortVal(a), vb = sortVal(b);
    if (va !== vb) return (va < vb ? -1 : 1) * dir;
    return sortKey === 'date' ? (timeValue(apptTime(a)) - timeValue(apptTime(b))) * dir : 0;
  });
  // A sort change can move the current page out of range
  useEffect(() => { setPage(1); }, [sortKey, sortDir]);

  // Completing a visit captures the doctor's notes first — the note becomes
  // the medical record the patient sees in their portal (no notes, no record)
  const [completeAppt, setCompleteAppt] = useState(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);

  const updateStatus = async (appt, newStatus) => {
    if (newStatus === appt.status) return;
    if (newStatus === 'completed') {
      setCompleteAppt(appt);
      setVisitNotes('');
      setNotesError('');
      return;
    }
    try {
      await setAdminAppointmentStatus(appt.id, { status: newStatus });
      const meta = (statusMeta(newStatus) || {}).label || newStatus;
      store.pushToast({ kind: 'success', title: 'Status updated', msg: `Appointment marked as ${meta}.` });
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Status update failed', msg: err instanceof ApiError ? err.message : 'Could not update status.' });
    }
  };

  const saveComplete = async () => {
    const notes = visitNotes.trim();
    if (notes.length < 10) {
      setNotesError('Please write the visit summary (10+ characters).');
      return;
    }
    setNotesBusy(true);
    try {
      await completeAdminAppointment(completeAppt.id, { notes });
      setCompleteAppt(null);
      store.pushToast({ kind: 'success', title: 'Visit completed', msg: "Doctor's notes saved and added to the patient's medical records." });
      load();
    } catch (err) {
      setNotesError(err instanceof ApiError ? err.message : 'Could not complete visit.');
    } finally {
      setNotesBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelLoading(true);
    try {
      await deleteAdminAppointment(confirmDel.id);
      setConfirmDel(null);
      store.pushToast({ kind: 'success', title: 'Appointment deleted', msg: 'The appointment has been removed.' });
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', msg: err instanceof ApiError ? err.message : 'Could not delete appointment.' });
    } finally {
      setDelLoading(false);
    }
  };

  const doExport = () => {
    downloadCSV('medicacare-appointments.csv', [
      ['Ref', 'Patient', 'Doctor', 'Specialty', 'Date', 'Time', 'Reason', 'Status'],
      ...sorted.map(a => [
        refOf(a), patientName(a), doctorName(a), doctorSpecialty(a),
        apptDate(a), apptTime(a), a.reason || '',
        (statusMeta(a.status) || {}).label || a.status,
      ]),
    ]);
    store.pushToast({ kind: 'success', title: 'Export ready', msg: `${sorted.length} appointment(s) exported to CSV.` });
  };

  const pendingCount = appointments.filter(a => a.status === 'pending').length;

  return (
    <AppShell current="appointments">
      <div className="page">
        <PageHeader
          title="Appointments"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 200, maxWidth: '100%', height: 14 }} />
            : `${total} total · ${pendingCount} pending review`}
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Appointments' }]}
          actions={<>
            <button className="btn btn-secondary" onClick={doExport}><Icon name="download" size={14} /> Export</button>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={14} /> New appointment</button>
          </>}
        />

        {error ? (
          <ErrorState title="Could not load appointments" message={error} onRetry={load} />
        ) : (
          <div className="card">
            <div className="table-toolbar">
              <div className="input-group search">
                <Icon name="search" size={16} className="input-icon" />
                <input className="input" style={{ paddingLeft: 38 }} placeholder="Search patient, doctor, or reason…" aria-label="Search appointments by patient, doctor, or reason" value={query} onChange={e => setQuery(e.target.value)} />
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
              <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> results
              </div>
            </div>

            <div className="table-wrap">
              <table className="table table-responsive-stack">
                <thead>
                  <tr>
                    <SortableTh label="Ref" k="ref" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Patient" k="patient" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Doctor" k="doctor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Date & time" k="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th>Reason</th>
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, r) => (
                      <tr key={r}>
                        <td data-label="Ref" className="t-mono td-nowrap"><span className="skel" style={{ width: 64, height: 11 }} /></td>
                        <td data-label="Patient">
                          <div className="cell-with-avatar">
                            <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <span className="skel" style={{ width: 110, maxWidth: '100%', height: 12, display: 'block' }} />
                              <span className="skel" style={{ width: 84, height: 10, display: 'block', marginTop: 4 }} />
                            </div>
                          </div>
                        </td>
                        <td data-label="Doctor" className="td-nowrap">
                          <div style={{ minWidth: 0 }}>
                            <span className="skel" style={{ width: 96, maxWidth: '100%', height: 12, display: 'block' }} />
                            <span className="skel" style={{ width: 72, height: 10, display: 'block', marginTop: 4 }} />
                          </div>
                        </td>
                        <td data-label="Date & time" className="td-nowrap">
                          <div>
                            <span className="skel" style={{ width: 78, height: 12, display: 'block' }} />
                            <span className="skel" style={{ width: 56, height: 10, display: 'block', marginTop: 4 }} />
                          </div>
                        </td>
                        <td data-label="Reason" className="cell-primary-truncate"><span className="skel" style={{ width: '75%', height: 12 }} /></td>
                        <td data-label="Status"><span className="skel" style={{ width: 96, height: 30 }} /></td>
                        <td className="col-actions">
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span className="skel" style={{ width: 24, height: 24 }} />
                            <span className="skel" style={{ width: 24, height: 24 }} />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : sorted.length === 0 ? (
                    <tr><td colSpan={7} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="calendar-x" title="No appointments match" message="Try adjusting your filters."
                        actions={<button className="btn btn-secondary" onClick={() => { setQuery(''); setStatus('all'); }}>Clear filters</button>} />
                    </td></tr>
                  ) : sorted.map(a => (
                    <tr key={a.id}>
                      <td data-label="Ref" className="t-mono td-nowrap" style={{ fontSize: 12 }}>{refOf(a)}</td>
                      <td data-label="Patient">
                        <div className="cell-with-avatar">
                          <PatientAvatar person={{ name: patientName(a) }} size={28} />
                          <div>
                            <div className="cell-primary cell-primary-truncate" style={{ maxWidth: 150 }}>{patientName(a)}</div>
                            <div className="cell-secondary">{a.patient?.phone || '—'}</div>
                            {a.booked_for && a.patient?.full_name && a.booked_for !== a.patient.full_name && (
                              <div className="cell-secondary">Booking for: {a.booked_for}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Doctor" className="td-nowrap">
                        <div className="cell-primary cell-primary-truncate" style={{ maxWidth: 150 }}>{doctorName(a)}</div>
                        <div className="cell-secondary">{doctorSpecialty(a)}</div>
                      </td>
                      <td data-label="Date & time" className="td-nowrap">
                        <div className="cell-primary">{formatDate(apptDate(a))}</div>
                        <div className="cell-secondary">{apptTime(a)}</div>
                      </td>
                      <td data-label="Reason" className="cell-primary-truncate" style={{ maxWidth: 150 }}>{a.reason || '—'}</td>
                      <td data-label="Status">
                        <SelectInput value={a.status} onChange={e => updateStatus(a, e.target.value)} className="status-select" aria-label="Change status">
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no-show">No-show</option>
                        </SelectInput>
                      </td>
                      <td className="col-actions" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-icon" title="View" aria-label="View appointment" onClick={() => setViewAppt(a)}><Icon name="eye" size={16} /></button>
                        <button className="btn-icon" title="Edit appointment" aria-label="Edit appointment" onClick={() => setEditAppt(a)}><Icon name="pencil" size={16} /></button>
                        <button className="btn-icon" title="Delete" aria-label="Delete appointment" onClick={() => setConfirmDel(a)} style={{ color: 'var(--error)' }}><Icon name="trash-2" size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && sorted.length > 0 && <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE_SIZE} label="appointments" />}
          </div>
        )}
      </div>

      <AppointmentFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <AppointmentDetailsModal appointment={viewAppt} onClose={() => setViewAppt(null)} />
      <AppointmentEditModal appointment={editAppt} onClose={() => setEditAppt(null)} onSaved={load} />

      {/* Doctor's notes captured when a visit is marked completed — these
          become the medical record shown on the patient's portal */}
      <Modal
        open={!!completeAppt}
        onClose={() => setCompleteAppt(null)}
        title="Complete visit"
        subtitle={completeAppt
          ? `${patientName(completeAppt)} · ${formatDate(apptDate(completeAppt))} at ${apptTime(completeAppt)}`
          : ''}
        icon="stethoscope"
        iconKind="info"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCompleteAppt(null)} disabled={notesBusy}>Cancel</button>
          <button className="btn btn-primary" onClick={saveComplete} disabled={notesBusy}>{notesBusy ? 'Saving…' : 'Save & complete visit'}</button>
        </>}
      >
        <Field
          label="Doctor's notes / visit summary"
          required
          error={notesError}
          help="Encoded from the doctor's written notes after the visit; saved to the patient's medical records in their portal."
        >
          <TextArea
            rows={4}
            placeholder="e.g., Blood pressure well controlled on current medication. Continue lifestyle changes; repeat ECG in 6 months."
            value={visitNotes}
            onChange={e => { setVisitNotes(e.target.value); if (notesError) setNotesError(''); }}
            error={notesError}
            maxLength={2000}
          />
        </Field>
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        loading={delLoading}
        title="Delete this appointment?"
        message={confirmDel ? `Ref ${refOf(confirmDel)} will be permanently removed from the system.` : ''}
        confirmLabel="Delete appointment"
        kind="danger"
      />
    </AppShell>
  );
}

export { AppointmentsMgmt };
