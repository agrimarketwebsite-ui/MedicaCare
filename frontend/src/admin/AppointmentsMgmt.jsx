// AppointmentsMgmt — all appointments (Phase 6).
// Filters (date/doctor/status) + table + create/edit (AppointmentFormModal) +
// status change (AppointmentStatusModal) + delete (ConfirmModal).
import { useEffect, useState } from 'react';
import {
  AppShell, ConfirmModal, EmptyState, ErrorState, Field, Icon, PageHeader,
  Pagination, SelectInput, SkeletonRows, StatusBadge, TextInput, useStore,
} from '../shared/components.jsx';
import { deleteAdminAppointment, getAdminAppointments, getAdminDoctors, ApiError } from '../shared/api.js';
import { AppointmentFormModal, AppointmentStatusModal } from './AppointmentModals.jsx';

const PAGE_SIZE = 15;
const STATUSES = ['', 'pending', 'confirmed', 'completed', 'cancelled', 'no-show'];

function fmtTime(t) {
  return (t || '').slice(0, 5);
}

function AppointmentsMgmt() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ date: '', doctor_id: '', status: '' });
  const [doctors, setDoctors] = useState([]);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusAppt, setStatusAppt] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminAppointments({ ...filters, page, limit: PAGE_SIZE });
      setAppointments(r.appointments);
      setTotal(r.total);
    } catch (err) {
      setError(err.message || 'Could not load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    getAdminDoctors('', 1, 100).then((r) => setDoctors(r.doctors)).catch(() => {});
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAdminAppointment(deleting.id);
      store.pushToast({ kind: 'success', title: 'Appointment deleted', message: 'The appointment was removed.' });
      setDeleting(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', message: err instanceof ApiError ? err.message : 'Could not delete the appointment.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const refOf = (a) => a.reference_code || a.appointment_ref || '';

  return (
    <AppShell current="appointments">
      <div className="page">
        <PageHeader
          title="Appointments"
          subtitle="All appointments across the clinic."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Appointments' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <form onSubmit={applyFilters} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label="Date">
                <TextInput
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                />
              </Field>
              <Field label="Doctor">
                <SelectInput
                  value={filters.doctor_id}
                  onChange={(e) => setFilters((f) => ({ ...f, doctor_id: e.target.value }))}
                  style={{ minWidth: 180 }}
                >
                  <option value="">All doctors</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Status">
                <SelectInput
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All statuses</option>
                  {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectInput>
              </Field>
              <button type="submit" className="btn btn-secondary">Filter</button>
              <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Icon name="plus" size={14} /> New appointment
              </button>
            </form>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <table className="table" aria-hidden="true">
              <thead>
                <tr><th>Ref</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr>
              </thead>
              <tbody><SkeletonRows rows={8} cols={7} /></tbody>
            </table>
          </div>
        ) : error ? (
          <ErrorState title="Could not load appointments" message={error} onRetry={load} />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon="calendar-days"
            title="No appointments found"
            message="Try a different filter, or book a new appointment."
          />
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr><th>Ref</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{refOf(a) || '—'}</strong></td>
                    <td className="t-muted">{a.patient?.full_name || a.booked_for || '—'}</td>
                    <td className="t-muted">{a.doctor?.full_name || '—'}</td>
                    <td className="t-muted">{(a.appointment_date || '').slice(0, 10)}</td>
                    <td className="t-muted">{fmtTime(a.start_time)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary sm" onClick={() => setStatusAppt(a)} title="Change status">
                        <Icon name="refresh-cw" size={14} /> Status
                      </button>
                      <button className="btn btn-ghost sm" onClick={() => { setEditing(a); setFormOpen(true); }} title="Edit">
                        <Icon name="pencil" size={14} />
                      </button>
                      <button className="btn btn-ghost sm" onClick={() => setDeleting(a)} title="Delete">
                        <Icon name="trash-2" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body">
              <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE_SIZE} label="appointments" />
            </div>
          </div>
        )}
      </div>

      <AppointmentFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        initial={editing}
        onSaved={load}
      />
      <AppointmentStatusModal
        open={!!statusAppt}
        onClose={() => setStatusAppt(null)}
        appointment={statusAppt}
        onSaved={load}
      />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={deleteBusy}
        title="Delete appointment?"
        message={`This will permanently remove appointment ${refOf(deleting || {}) || 'this'} from the schedule.`}
        confirmLabel="Delete appointment"
      />
    </AppShell>
  );
}

export { AppointmentsMgmt };
