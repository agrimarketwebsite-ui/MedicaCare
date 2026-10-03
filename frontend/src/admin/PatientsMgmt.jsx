// PatientsMgmt — admin patient registry (restored prototype UI, real API).
// Search + gender filter + table + add (PatientFormModal) + delete +
// labs & medications (PatientRecordsModal).
import { useEffect, useState } from 'react';
import {
  AppShell, ConfirmModal, EmptyState, ErrorState, Icon, PageHeader,
  Pagination, PatientAvatar, SkeletonRows, useStore,
} from '../shared/components.jsx';
import { formatDate } from '../shared/data.js';
import { deleteAdminPatient, getAdminPatients } from '../shared/api.js';
import { downloadCSV } from './helpers.js';

import { PatientFormModal } from './PatientFormModal.jsx';
import { PatientRecordsModal } from './PatientRecordsModal.jsx';

const PAGE = 15;

// ---------- Patients Management ----------
function PatientsMgmt() {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [delLoading, setDelLoading] = useState(false);
  // Labs & medications — the staff-side creation path for the patient's
  // Medical Records sections (opened per patient from the table row)
  const [recordsFor, setRecordsFor] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [gender, setGender] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminPatients(query.trim(), page, PAGE);
      setPatients(r.patients);
      setTotal(r.total);
    } catch (err) {
      setError(err.message || 'Could not load patients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live search (debounced) + gender filter applied client-side on the page
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = patients.filter(p => {
    if (gender !== 'all' && (p.gender || '').toLowerCase() !== gender) return false;
    return true;
  });

  const ageOf = (p) => {
    if (!p.date_of_birth) return null;
    const dob = new Date(String(p.date_of_birth).slice(0, 10));
    if (isNaN(dob)) return null;
    const n = new Date();
    let age = n.getFullYear() - dob.getFullYear();
    const m = n.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < dob.getDate())) age--;
    return age;
  };
  const genderLabel = (g) => {
    const v = (g || '').toLowerCase();
    return v === 'male' ? 'Male' : v === 'female' ? 'Female' : v === 'other' ? 'Other' : '—';
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelLoading(true);
    try {
      await deleteAdminPatient(confirmDel.id);
      setConfirmDel(null);
      store.pushToast({ kind: 'success', title: 'Patient removed', msg: `${confirmDel.full_name}'s record has been deleted.` });
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', msg: err.message || 'Could not delete patient.' });
    } finally {
      setDelLoading(false);
    }
  };

  const doExport = () => {
    downloadCSV('medicacare-patients.csv', [
      ['ID', 'Name', 'Email', 'Phone', 'Gender', 'Age', 'Joined', 'Last visit'],
      ...filtered.map(p => [
        p.id, p.full_name, p.email || '', p.phone || '',
        genderLabel(p.gender), ageOf(p) ?? '', (p.created_at || '').slice(0, 10),
        (p.last_visit_date || '').slice(0, 10),
      ]),
    ]);
    store.pushToast({ kind: 'success', title: 'Export ready', msg: `${filtered.length} patient(s) exported to CSV.` });
  };

  return (
    <AppShell current="patients">
      <div className="page">
        <PageHeader
          title="Patients"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 160, maxWidth: '100%', height: 14 }} />
            : `${total} registered patients`}
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Patients' }]}
          actions={
            <>
              <button className="btn btn-secondary" onClick={doExport}><Icon name="download" size={14} /> Export CSV</button>
              <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Icon name="user-plus" size={14} /> Add patient</button>
            </>
          }
        />

        {error ? (
          <ErrorState title="Could not load patients" message={error} onRetry={load} />
        ) : (
          <div className="card">
            <div className="table-toolbar">
              <div className="input-group search">
                <Icon name="search" size={16} className="input-icon" />
                <input className="input" style={{ paddingLeft: 38 }} placeholder="Search by name, email, or phone…" aria-label="Search patients by name, email, or phone" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <button className="btn btn-secondary sm" onClick={() => setFilterOpen(o => !o)}>
                <Icon name="filter" size={14} /> Filter{gender !== 'all' ? `: ${gender === 'male' ? 'Male' : 'Female'}` : ''}
              </button>
              <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> matching
              </div>
            </div>

            {filterOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Filter by gender:</span>
                {[['all', 'All'], ['male', 'Male'], ['female', 'Female']].map(([k, l]) => (
                  <button key={k} className={'chip filter' + (gender === k ? ' on' : '')} onClick={() => setGender(k)}>{l}</button>
                ))}
              </div>
            )}

            <div className="table-wrap">
              <table className="table table-responsive-stack">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Contact</th>
                    <th>Gender / Age</th>
                    <th>Joined</th>
                    <th>Last visit</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, r) => (
                      <tr key={r}>
                        <td data-label="Patient">
                          <div className="cell-with-avatar">
                            <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <span className="skel" style={{ width: 110, maxWidth: '100%', height: 12, display: 'block' }} />
                              <span className="skel" style={{ width: 64, height: 10, display: 'block', marginTop: 4 }} />
                            </div>
                          </div>
                        </td>
                        <td data-label="Contact">
                          <div><span className="skel" style={{ width: 130, maxWidth: '100%', height: 11, display: 'inline-block' }} /></div>
                          <div style={{ marginTop: 3 }}><span className="skel" style={{ width: 92, height: 10, display: 'inline-block' }} /></div>
                        </td>
                        <td data-label="Gender / Age"><span className="skel" style={{ width: 60, height: 12 }} /></td>
                        <td data-label="Joined"><span className="skel" style={{ width: 72, height: 12 }} /></td>
                        <td data-label="Last visit"><span className="skel" style={{ width: 72, height: 12 }} /></td>
                        <td className="col-actions"><span className="skel" style={{ width: 24, height: 24 }} /></td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="user-x" title={query ? `No patients found for "${query}"` : 'No patients found'}
                        message="Try a different name, or add a new patient record."
                        actions={<>
                          {query && <button className="btn btn-secondary" onClick={() => setQuery('')}>Clear search</button>}
                          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Icon name="user-plus" size={14} /> Add patient</button>
                        </>} />
                    </td></tr>
                  ) : filtered.map(p => {
                    const age = ageOf(p);
                    return (
                      <tr key={p.id}>
                        <td data-label="Patient">
                          <div className="cell-with-avatar">
                            <PatientAvatar person={{ name: p.full_name }} size={28} />
                            <div>
                              <div className="cell-primary cell-primary-truncate">{p.full_name}</div>
                              <div className="cell-secondary t-mono">{String(p.id).slice(0, 8).toUpperCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Contact">
                          <div>{p.email || <span className="t-muted">—</span>}</div>
                          <div className="cell-secondary">{p.phone || '—'}</div>
                        </td>
                        <td data-label="Gender / Age">{genderLabel(p.gender)}{age != null ? `, ${age}` : ''}</td>
                        <td data-label="Joined">{p.created_at ? formatDate(String(p.created_at).slice(0, 10)) : '—'}</td>
                        <td data-label="Last visit">{p.last_visit_date ? formatDate(String(p.last_visit_date).slice(0, 10)) : <span className="t-muted">—</span>}</td>
                        <td className="col-actions">
                          {/* No edit action: personal info is owned by the patient —
                              they manage it on their Profile page */}
                          <button className="btn-icon" title="Labs & medications" aria-label="Manage labs and medications" onClick={() => setRecordsFor(p)}><Icon name="folder-open" size={16} /></button>
                          <button className="btn-icon" title="Delete" aria-label="Delete patient" onClick={() => setConfirmDel(p)} style={{ color: 'var(--error)' }}><Icon name="trash-2" size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length > 0 && <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE} label="patients" />}
          </div>
        )}
      </div>

      <PatientFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <PatientRecordsModal patient={recordsFor} onClose={() => setRecordsFor(null)} />
      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={doDelete}
        loading={delLoading}
        title="Delete patient record?"
        message={confirmDel ? `${confirmDel.full_name}'s account and all associated data will be permanently deleted. This action cannot be undone.` : ''}
        confirmLabel="Delete permanently"
        kind="danger"
      />
    </AppShell>
  );
}

export { PatientsMgmt };
