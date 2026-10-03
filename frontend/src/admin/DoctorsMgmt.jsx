// DoctorsMgmt — doctor directory (Phase 6).
// Table + add/edit (DoctorFormModal — may portal-access section) + delete
// (ConfirmModal) + availability sub-view (simple list + inline add/edit/delete
// para sa napiling doctor).
import { useEffect, useState } from 'react';
import {
  AppShell, Badge, ConfirmModal, DoctorStatusBadge, EmptyState, ErrorState,
  Field, Icon, PageHeader, Pagination, SelectInput, SkeletonRows,
  TextInput, useStore,
} from '../shared/components.jsx';
import {
  createAdminDoctorAvailability, deleteAdminDoctor, deleteAdminDoctorAvailability,
  getAdminDoctorAvailability, getAdminDoctors, updateAdminDoctorAvailability, ApiError,
} from '../shared/api.js';
import { DoctorFormModal } from './DoctorFormModal.jsx';

const PAGE_SIZE = 15;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtDay(d) {
  const n = Number(d);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? DAYS[n] : String(d ?? '—');
}

// ---------- Availability sub-view ----------
function AvailabilityPanel({ doctor, onClose }) {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ day_of_week: '1', start_time: '09:00', end_time: '17:00' });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getAdminDoctorAvailability(doctor.id);
      setEntries(list);
    } catch (err) {
      setError(err.message || 'Could not load availability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [doctor.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setForm({ day_of_week: '1', start_time: '09:00', end_time: '17:00' });
    setEditingId(null);
  };

  const doSave = async () => {
    if (!form.start_time || !form.end_time) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
      };
      if (editingId) {
        await updateAdminDoctorAvailability(doctor.id, editingId, body);
        store.pushToast({ kind: 'success', title: 'Availability updated', message: 'The time slot was updated.' });
      } else {
        await createAdminDoctorAvailability(doctor.id, body);
        store.pushToast({ kind: 'success', title: 'Availability added', message: 'The time slot was added.' });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the availability slot.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deletingId) return;
    setBusy(true);
    try {
      await deleteAdminDoctorAvailability(doctor.id, deletingId);
      store.pushToast({ kind: 'success', title: 'Availability removed', message: 'The time slot was removed.' });
      setDeletingId(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', message: err instanceof ApiError ? err.message : 'Could not remove the slot.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Availability — {doctor.full_name}</h3>
            <p className="t-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              Weekly schedule that patients see when booking.
            </p>
          </div>
          <button className="btn btn-ghost sm" onClick={onClose}>
            <Icon name="x" size={14} /> Close
          </button>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        {loading ? (
          <table className="table" aria-hidden="true">
            <tbody><SkeletonRows rows={4} cols={4} /></tbody>
          </table>
        ) : entries.length === 0 ? (
          <EmptyState icon="clock" title="No availability set" message="Add the doctor's weekly slots below." />
        ) : (
          <table className="table">
            <thead><tr><th>Day</th><th>Start</th><th>End</th><th></th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><strong>{fmtDay(e.day_of_week)}</strong></td>
                  <td className="t-muted">{(e.start_time || '').slice(0, 5)}</td>
                  <td className="t-muted">{(e.end_time || '').slice(0, 5)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-ghost sm"
                      onClick={() => {
                        setEditingId(e.id);
                        setForm({
                          day_of_week: String(e.day_of_week ?? 1),
                          start_time: (e.start_time || '').slice(0, 5),
                          end_time: (e.end_time || '').slice(0, 5),
                        });
                      }}
                      title="Edit"
                    >
                      <Icon name="pencil" size={14} />
                    </button>
                    <button className="btn btn-ghost sm" onClick={() => setDeletingId(e.id)} title="Delete">
                      <Icon name="trash-2" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
          <Field label="Day">
            <SelectInput value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: e.target.value }))}>
              {DAYS.map((d, i) => <option key={d} value={String(i)}>{d}</option>)}
            </SelectInput>
          </Field>
          <Field label="Start">
            <TextInput type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
          </Field>
          <Field label="End">
            <TextInput type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
          </Field>
          <button className="btn btn-secondary sm" onClick={doSave} disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Update slot' : 'Add slot'}
          </button>
          {editingId && <button className="btn btn-ghost sm" onClick={resetForm} disabled={busy}>Cancel</button>}
        </div>
      </div>

      <ConfirmModal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={doDelete}
        loading={busy}
        title="Remove availability slot?"
        message="This slot will no longer be bookable by patients."
        confirmLabel="Remove slot"
      />
    </div>
  );
}

// ---------- Main page ----------
function DoctorsMgmt() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [availDoctor, setAvailDoctor] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminDoctors(query.trim(), page, PAGE_SIZE);
      setDoctors(r.doctors);
      setTotal(r.total);
    } catch (err) {
      setError(err.message || 'Could not load doctors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAdminDoctor(deleting.id);
      store.pushToast({ kind: 'success', title: 'Doctor deleted', message: `${deleting.full_name} was removed from the directory.` });
      setDeleting(null);
      if (availDoctor?.id === deleting.id) setAvailDoctor(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', message: err instanceof ApiError ? err.message : 'Could not delete the doctor.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <AppShell current="doctors">
      <div className="page">
        <PageHeader
          title="Doctors"
          subtitle="Doctor directory — profiles, availability, and portal access."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Doctors' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <form onSubmit={onSearch} style={{ display: 'flex', gap: 8 }}>
              <TextInput
                icon="search"
                placeholder="Search name or specialty…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-secondary">Search</button>
              <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Icon name="plus" size={14} /> Add doctor
              </button>
            </form>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <table className="table" aria-hidden="true">
              <thead>
                <tr><th>Doctor</th><th>Specialty</th><th>Fee</th><th>Status</th><th>Portal</th><th></th></tr>
              </thead>
              <tbody><SkeletonRows rows={8} cols={6} /></tbody>
            </table>
          </div>
        ) : error ? (
          <ErrorState title="Could not load doctors" message={error} onRetry={load} />
        ) : doctors.length === 0 ? (
          <EmptyState
            icon="stethoscope"
            title={query ? 'No matching doctors' : 'No doctors yet'}
            message={query ? 'Try a different search.' : 'Add the first doctor to the directory.'}
          />
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr><th>Doctor</th><th>Specialty</th><th>Fee</th><th>Status</th><th>Portal</th><th></th></tr>
              </thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.full_name}</strong></td>
                    <td className="t-muted">{d.specialty_name || '—'}</td>
                    <td className="t-muted">{d.consultation_fee != null ? `₱${Number(d.consultation_fee).toLocaleString()}` : '—'}</td>
                    <td><DoctorStatusBadge status={d.status} /></td>
                    <td>
                      {d.has_portal_access || d.portal_email
                        ? <Badge kind="success">Enabled</Badge>
                        : <Badge kind="neutral">None</Badge>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary sm" onClick={() => setAvailDoctor(d)} title="Manage availability">
                        <Icon name="clock" size={14} /> Availability
                      </button>
                      <button className="btn btn-ghost sm" onClick={() => { setEditing(d); setFormOpen(true); }} title="Edit">
                        <Icon name="pencil" size={14} />
                      </button>
                      <button className="btn btn-ghost sm" onClick={() => setDeleting(d)} title="Delete">
                        <Icon name="trash-2" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body">
              <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE_SIZE} label="doctors" />
            </div>
          </div>
        )}

        {availDoctor && (
          <AvailabilityPanel key={availDoctor.id} doctor={availDoctor} onClose={() => setAvailDoctor(null)} />
        )}
      </div>

      <DoctorFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        initial={editing}
        onSaved={load}
      />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={deleteBusy}
        title="Delete doctor?"
        message={`This will remove ${deleting?.full_name || 'this doctor'} from the directory.`}
        confirmLabel="Delete doctor"
      />
    </AppShell>
  );
}

export { DoctorsMgmt };
