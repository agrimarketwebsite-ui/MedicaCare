// DoctorsMgmt — doctor directory (restored prototype UI, real API).
// Table + add/edit (DoctorFormModal) + delete (ConfirmModal) + availability
// sub-view + specialty filter + Export CSV.
import { useEffect, useState } from 'react';
import {
  AppShell, Badge, ConfirmModal, DoctorAvatar, DoctorStatusBadge, EmptyState,
  ErrorState, Icon, PageHeader, Pagination, SelectInput, SkeletonRows, useStore,
} from '../shared/components.jsx';
import { formatDayRange } from '../shared/data.js';
import {
  deleteAdminDoctor, getAdminDoctorAvailability, getAdminDoctors,
  getSpecialtyBreakdown, ApiError,
} from '../shared/api.js';
import { downloadCSV, localToday, printDoctorSchedule } from './helpers.js';
import { DoctorFormModal } from './DoctorFormModal.jsx';
import { getAdminAppointments } from '../shared/api.js';

const PAGE_SIZE = 15;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtDay(d) {
  const n = Number(d);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? DAYS[n] : String(d ?? '—');
}

// ---------- Availability sub-view (kept from Phase 6) ----------
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
        const { updateAdminDoctorAvailability } = await import('../shared/api.js');
        await updateAdminDoctorAvailability(doctor.id, editingId, body);
        store.pushToast({ kind: 'success', title: 'Availability updated', message: 'The time slot was updated.' });
      } else {
        const { createAdminDoctorAvailability } = await import('../shared/api.js');
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
      const { deleteAdminDoctorAvailability } = await import('../shared/api.js');
      await deleteAdminDoctorAvailability(doctor.id, deletingId);
      store.pushToast({ kind: 'success', title: 'Slot removed', message: 'The availability slot was removed.' });
      setDeletingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the slot.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div>
          <h3 style={{ margin: 0 }}>Availability — {doctor.full_name}</h3>
          <div className="t-muted" style={{ fontSize: 12.5 }}>Weekly schedule that patients see when booking.</div>
        </div>
        <button className="btn btn-ghost sm" onClick={onClose}><Icon name="x" size={14} /> Close</button>
      </div>
      <div className="card-body">
        {error && <div className="form-error" style={{ marginBottom: 12 }}><Icon name="alert-circle" size={14} /> {error}</div>}
        {loading ? (
          <table className="table" aria-hidden="true"><tbody><SkeletonRows rows={3} cols={4} /></tbody></table>
        ) : entries.length === 0 ? (
          <EmptyState icon="clock" title="No availability set" message="Add the doctor's weekly slots below." />
        ) : (
          <table className="table">
            <thead><tr><th>Day</th><th>Start</th><th>End</th><th></th></tr></thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td>{fmtDay(e.day_of_week)}</td>
                  <td className="t-muted">{(e.start_time || '').slice(0, 5)}</td>
                  <td className="t-muted">{(e.end_time || '').slice(0, 5)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost sm" title="Edit slot" onClick={() => {
                      setForm({ day_of_week: String(e.day_of_week), start_time: (e.start_time || '').slice(0, 5), end_time: (e.end_time || '').slice(0, 5) });
                      setEditingId(e.id);
                    }}><Icon name="pencil" size={14} /></button>
                    <button className="btn btn-ghost sm" title="Remove slot" onClick={() => setDeletingId(e.id)}><Icon name="trash-2" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12.5 }}>Day
            <SelectInput value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))} style={{ marginLeft: 6 }}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </SelectInput>
          </label>
          <label style={{ fontSize: 12.5 }}>Start
            <input type="time" className="input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={{ marginLeft: 6 }} />
          </label>
          <label style={{ fontSize: 12.5 }}>End
            <input type="time" className="input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} style={{ marginLeft: 6 }} />
          </label>
          <button className="btn btn-secondary sm" onClick={doSave} disabled={busy}>{editingId ? 'Update slot' : 'Add slot'}</button>
          {editingId && <button className="btn btn-ghost sm" onClick={resetForm}>Cancel</button>}
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

// ---------- Doctors Management ----------
function DoctorsMgmt() {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [specialties, setSpecialties] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [total, setTotal] = useState(0);
  const [availMap, setAvailMap] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [availDoctor, setAvailDoctor] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, spec] = await Promise.all([
        getAdminDoctors(query.trim(), page, PAGE_SIZE),
        getSpecialtyBreakdown().catch(() => []),
      ]);
      setDoctors(r.doctors);
      setTotal(r.total);
      setSpecialties(spec.map(s => s.specialty).filter(Boolean));
      // Fetch availability day-ranges for the page (for the Availability column)
      const availEntries = await Promise.all(
        r.doctors.map(d => getAdminDoctorAvailability(d.id).catch(() => []))
      );
      const map = {};
      r.doctors.forEach((d, i) => {
        const days = [...new Set(availEntries[i].map(e => Number(e.day_of_week)))].sort();
        map[d.id] = days;
      });
      setAvailMap(map);
    } catch (err) {
      setError(err.message || 'Could not load doctors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = doctors.filter(d => {
    if (specialty !== 'all' && (d.specialties?.name || d.specialty_name) !== specialty) return false;
    return true;
  });

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAdminDoctor(deleting.id);
      store.pushToast({ kind: 'success', title: 'Doctor removed', message: `${deleting.full_name}'s profile has been deleted.` });
      setDeleting(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', message: err.message || 'Could not delete doctor.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const doExport = () => {
    downloadCSV('medicacare-doctors.csv', [
      ['ID', 'Name', 'Specialty', 'Status', 'Clinic days', 'Experience (yrs)', 'Consultation fee (₱)', 'Room'],
      ...filtered.map(d => [
        d.id, d.full_name, d.specialties?.name || d.specialty_name || '',
        d.status, formatDayRange(availMap[d.id] || []),
        d.years_of_experience ?? '', d.consultation_fee ?? '', d.room || '',
      ]),
    ]);
    store.pushToast({ kind: 'success', title: 'Export ready', message: `${filtered.length} doctor(s) exported to CSV.` });
  };

  const specialtyOf = (d) => d.specialties?.name || d.specialty_name || '—';

  // Staff print the day's patient list for a doctor (PDF via the browser's
  // native "Save as PDF")
  const printSchedule = async (d) => {
    const today = localToday();
    try {
      const r = await getAdminAppointments({ date: today, doctor_id: d.id, limit: 200 });
      const list = (r.appointments || []).sort((a, b) =>
        (a.start_time || '').localeCompare(b.start_time || ''));
      printDoctorSchedule(d, list, today);
      store.pushToast({
        kind: 'success',
        title: 'Print dialog opened',
        message: `Choose "Save as PDF" as the destination to download today's ${list.length} appointment(s) as a PDF.`,
      });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Print failed', message: err.message || 'Could not load today\'s schedule.' });
    }
  };

  return (
    <AppShell current="doctors">
      <div className="page">
        <PageHeader
          title="Doctors"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 240, maxWidth: '100%', height: 14 }} />
            : `${total} doctors across ${specialties.length} specialties`}
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Doctors' }]}
          actions={<>
            <button className="btn btn-secondary" onClick={doExport}><Icon name="download" size={14} /> Export CSV</button>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={14} /> Add doctor</button>
          </>}
        />

        {error ? (
          <ErrorState title="Could not load doctors" message={error} onRetry={load} />
        ) : (
          <div className="card">
            <div className="table-toolbar">
              <div className="input-group search">
                <Icon name="search" size={16} className="input-icon" />
                <input className="input" style={{ paddingLeft: 38 }} placeholder="Search by name or specialty…" aria-label="Search doctors by name or specialty" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <SelectInput style={{ maxWidth: 180 }} value={specialty} onChange={e => setSpecialty(e.target.value)} aria-label="Filter by specialty">
                <option value="all">All specialties</option>
                {specialties.map(s => <option key={s} value={s}>{s}</option>)}
              </SelectInput>
            </div>

            <div className="table-wrap">
              <table className="table table-responsive-stack table-compact">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Specialty</th>
                    <th>Status</th>
                    <th>Availability</th>
                    <th>Experience</th>
                    <th>Fee</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, r) => (
                      <tr key={r}>
                        <td data-label="Doctor">
                          <div className="cell-with-avatar">
                            <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <span className="skel" style={{ width: 110, maxWidth: '100%', height: 12, display: 'block' }} />
                              <span className="skel" style={{ width: 90, height: 10, display: 'block', marginTop: 4 }} />
                            </div>
                          </div>
                        </td>
                        <td data-label="Specialty"><span className="skel" style={{ width: '65%', height: 12 }} /></td>
                        <td data-label="Status"><span className="skel" style={{ width: 64, height: 18 }} /></td>
                        <td data-label="Availability" className="td-nowrap"><span className="skel" style={{ width: 96, height: 11 }} /></td>
                        <td data-label="Experience"><span className="skel" style={{ width: 40, height: 12 }} /></td>
                        <td data-label="Fee"><span className="skel" style={{ width: 56, height: 12 }} /></td>
                        <td className="col-actions">
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span className="skel" style={{ width: 24, height: 24 }} />
                            <span className="skel" style={{ width: 24, height: 24 }} />
                            <span className="skel" style={{ width: 24, height: 24 }} />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="stethoscope" title="No doctors found" message="Try clearing your search or add a new doctor."
                        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={14} /> Add doctor</button>} />
                    </td></tr>
                  ) : filtered.map(d => (
                    <tr key={d.id}>
                      <td data-label="Doctor">
                        <div className="cell-with-avatar">
                          <DoctorAvatar doctor={{ name: d.full_name, photo: d.photo_url }} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div className="cell-primary cell-primary-truncate" style={{ maxWidth: 150 }} title={d.full_name}>{d.full_name}</div>
                            <div className="cell-secondary">{d.room || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Specialty">{specialtyOf(d)}</td>
                      <td data-label="Status"><DoctorStatusBadge status={d.status} /></td>
                      <td data-label="Availability" className="td-nowrap" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {formatDayRange(availMap[d.id] || [])}
                      </td>
                      <td data-label="Experience">{d.years_of_experience != null ? `${d.years_of_experience} yrs` : '—'}</td>
                      <td data-label="Fee">{d.consultation_fee != null ? `₱${Number(d.consultation_fee).toLocaleString()}` : '—'}</td>
                      <td className="col-actions" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary sm" onClick={() => setAvailDoctor(d)} title="Manage availability">
                          <Icon name="clock" size={14} /> Availability
                        </button>
                        <button className="btn-icon" title="Print / save schedule as PDF" aria-label="Print or save today's schedule as PDF" onClick={() => printSchedule(d)}><Icon name="printer" size={16} /></button>
                        <button className="btn-icon" title="Edit" aria-label="Edit doctor" onClick={() => { setEditing(d); setFormOpen(true); }}><Icon name="pencil" size={16} /></button>
                        <button className="btn-icon" title="Delete" aria-label="Delete doctor" onClick={() => setDeleting(d)} style={{ color: 'var(--error)' }}><Icon name="trash-2" size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length > 0 && <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE_SIZE} label="doctors" />}
          </div>
        )}

        {availDoctor && (
          <AvailabilityPanel key={availDoctor.id} doctor={availDoctor} onClose={() => { setAvailDoctor(null); load(); }} />
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
        title="Delete this doctor?"
        message={deleting ? `${deleting.full_name}'s profile will be removed. Existing appointments will remain but the doctor will no longer be bookable.` : ''}
        confirmLabel="Delete doctor"
        kind="danger"
      />
    </AppShell>
  );
}

export { DoctorsMgmt };
