// DoctorsMgmt — doctor directory (restored prototype UI, real API).
// Table + add/edit (DoctorFormModal) + delete (ConfirmModal) + specialty
// filter + Export CSV. The weekly availability shown in the table comes from
// the availability API (weekday 1–7 ISO); it is edited from the doctor form's
// "Weekly availability" day picker (prototype), synced to the API on save.
import { useEffect, useRef, useState } from 'react';
import {
  AppShell, ConfirmModal, DoctorAvatar, DoctorRatingPill, DoctorStatusBadge, EmptyState,
  ErrorState, Icon, PageHeader, Pagination, SelectInput, useStore,
} from '../shared/components.jsx';
import { formatDayRange } from '../shared/data.js';
import {
  apiOptional, deleteAdminDoctor, getAdminDoctorAvailability, getAdminDoctors,
} from '../shared/api.js';
import { downloadCSV, localToday, printDoctorSchedule } from './helpers.js';
import { DoctorFormModal } from './DoctorFormModal.jsx';
import { getAdminAppointments } from '../shared/api.js';

const PAGE = 4;
// Real API convention: weekday 1–7 ISO (1 = Monday … 7 = Sunday).
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  const [ratingsMap, setRatingsMap] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Availability day-ranges for the Availability column, for a list of doctors.
  const fetchAvailMap = async (list) => {
    const availEntries = await Promise.all(
      list.map(d => getAdminDoctorAvailability(d.id).catch(() => []))
    );
    const map = {};
    list.forEach((d, i) => {
      const days = [...new Set(availEntries[i].map(e => Number(e.weekday)))]
        .filter(w => Number.isInteger(w) && w >= 1 && w <= 7)
        .sort((a, b) => a - b);
      map[d.id] = days.map(w => DAY_SHORT[w - 1]);
    });
    return map;
  };

  const specialtyIdOf = (name) =>
    name === 'all' ? undefined : (specialties.find(s => s.name === name) || {}).id;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, ratings] = await Promise.all([
        getAdminDoctors(query.trim(), page, PAGE, specialtyIdOf(specialty)),
        // Real ratings for the Rating column (public directory carries
        // avg_rating / rating_count from v_doctor_rating_averages)
        apiOptional('/doctors?limit=100', { auth: false }),
      ]);
      setDoctors(r.doctors);
      setTotal(r.total);
      const rm = {};
      ((ratings && ratings.doctors) || []).forEach(d => {
        rm[d.id] = {
          avg: d.avg_rating != null ? Number(d.avg_rating) : null,
          count: d.rating_count || 0,
        };
      });
      setRatingsMap(rm);
      setAvailMap(await fetchAvailMap(r.doctors));
    } catch (err) {
      setError(err.message || 'Could not load doctors.');
    } finally {
      setLoading(false);
    }
  };

  // All specialties for the filter dropdown (prototype lists every specialty)
  useEffect(() => {
    let cancelled = false;
    apiOptional('/doctors/specialties', { auth: false }).then((d) => {
      if (!cancelled) setSpecialties((d && d.specialties) || []);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { load(); }, [page, specialty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live search (debounced); skipped on mount (the effect above loads)
  const firstQuery = useRef(true);
  useEffect(() => {
    if (firstQuery.current) { firstQuery.current = false; return; }
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const specialtyOf = (d) => d.specialties?.name || d.specialty_name || '—';

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAdminDoctor(deleting.id);
      store.pushToast({ kind: 'success', title: 'Doctor removed', msg: `${deleting.full_name}'s profile has been deleted.` });
      setDeleting(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', msg: err.message || 'Could not delete doctor.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const doExport = async () => {
    try {
      // Export the full filtered set like the prototype (not just the page)
      const r = await getAdminDoctors(query.trim(), 1, 100, specialtyIdOf(specialty));
      const [ratings, am] = await Promise.all([
        apiOptional('/doctors?limit=100', { auth: false }),
        fetchAvailMap(r.doctors),
      ]);
      const rm = {};
      ((ratings && ratings.doctors) || []).forEach(d => {
        rm[d.id] = {
          avg: d.avg_rating != null ? Number(d.avg_rating) : null,
          count: d.rating_count || 0,
        };
      });
      downloadCSV('medicacare-doctors.csv', [
        ['ID', 'Name', 'Specialty', 'Status', 'Clinic days', 'Experience (yrs)', 'Avg. rating', 'Ratings', 'Consultation fee (₱)', 'Room'],
        ...r.doctors.map(d => {
          const rt = rm[d.id] || {};
          const count = rt.count || 0;
          return [
            d.id, d.full_name, specialtyOf(d), d.status,
            formatDayRange(am[d.id] || []),
            d.years_of_experience ?? '',
            count && rt.avg != null ? Math.round(Number(rt.avg) * 10) / 10 : '',
            count,
            d.consultation_fee ?? '', d.room || '',
          ];
        }),
      ]);
      store.pushToast({ kind: 'success', title: 'Export ready', msg: `${r.doctors.length} doctor(s) exported to CSV.` });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Export failed', msg: err.message || 'Could not export doctors.' });
    }
  };

  // Staff print the day's patient list for a doctor (PDF via the browser's
  // native "Save as PDF"), then encode the doctor's written notes afterwards
  const printSchedule = async (d) => {
    const today = localToday();
    try {
      const r = await getAdminAppointments({ date: today, doctor_id: d.id, limit: 100 });
      const list = (r.appointments || []).sort((a, b) =>
        (a.start_time || '').localeCompare(b.start_time || ''));
      printDoctorSchedule(d, list, today);
      store.pushToast({
        kind: 'success',
        title: 'Print dialog opened',
        msg: `Choose "Save as PDF" as the destination to download today's ${list.length} appointment(s) as a PDF.`,
      });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Print failed', msg: err.message || 'Could not load today\'s schedule.' });
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
              <SelectInput style={{ maxWidth: 180 }} value={specialty} onChange={e => { setSpecialty(e.target.value); setPage(1); }}>
                <option value="all">All specialties</option>
                {specialties.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
                    <th>Rating</th>
                    <th>Fee</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    // Skeleton rows mirroring the real ones: the Doctor cell has
                    // an avatar + room line, Status is a badge pill, and every
                    // cell carries data-label for the mobile stacked-card view
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
                        <td data-label="Rating"><span className="skel" style={{ width: 44, height: 12 }} /></td>
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
                  ) : doctors.length === 0 ? (
                    <tr><td colSpan={8} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="stethoscope" title="No doctors found" message="Try clearing your search or add a new doctor."
                        actions={<button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={14} /> Add doctor</button>} />
                    </td></tr>
                  ) : doctors.map(d => {
                    const rt = ratingsMap[d.id] || {};
                    return (
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
                        <td data-label="Availability" className="td-nowrap" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }} title={(availMap[d.id] || []).length ? availMap[d.id].join(', ') : undefined}>
                          {formatDayRange(availMap[d.id] || [])}
                        </td>
                        <td data-label="Experience">{d.years_of_experience != null ? `${d.years_of_experience} yrs` : '—'}</td>
                        <td data-label="Rating">
                          <DoctorRatingPill avg={rt.avg ?? null} count={rt.count || 0} compact />
                        </td>
                        <td data-label="Fee">{d.consultation_fee != null ? `₱${Number(d.consultation_fee).toLocaleString()}` : '—'}</td>
                        <td className="col-actions">
                          <button className="btn-icon" title="Print / save schedule as PDF" aria-label="Print or save today's schedule as PDF" onClick={() => printSchedule(d)}><Icon name="printer" size={16} /></button>
                          <button className="btn-icon" title="Edit" aria-label="Edit doctor" onClick={() => { setEditing(d); setFormOpen(true); }}><Icon name="pencil" size={16} /></button>
                          <button className="btn-icon" title="Delete" aria-label="Delete doctor" onClick={() => setDeleting(d)} style={{ color: 'var(--error)' }}><Icon name="trash-2" size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && doctors.length > 0 && <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE} label="doctors" />}
          </div>
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
