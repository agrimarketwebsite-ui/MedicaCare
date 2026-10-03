// PatientsMgmt — patient registry (Phase 6).
// Search + table + add/edit (PatientFormModal) + delete (ConfirmModal) +
// view (PatientRecordsModal, read-only).
import { useEffect, useState } from 'react';
import {
  AppShell, ConfirmModal, EmptyState, ErrorState, Icon, PageHeader,
  Pagination, SkeletonRows, TextInput, useStore,
} from '../shared/components.jsx';
import { deleteAdminPatient, getAdminPatients, ApiError } from '../shared/api.js';
import { PatientFormModal } from './PatientFormModal.jsx';
import { PatientRecordsModal } from './PatientRecordsModal.jsx';

const PAGE_SIZE = 15;

function PatientsMgmt() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminPatients(query.trim(), page, PAGE_SIZE);
      setPatients(r.patients);
      setTotal(r.total);
    } catch (err) {
      setError(err.message || 'Could not load patients.');
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
      await deleteAdminPatient(deleting.id);
      store.pushToast({ kind: 'success', title: 'Patient deleted', message: `${deleting.full_name} was removed from the registry.` });
      setDeleting(null);
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Delete failed', message: err instanceof ApiError ? err.message : 'Could not delete the patient.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <AppShell current="patients">
      <div className="page">
        <PageHeader
          title="Patients"
          subtitle="Patient registry — add, edit, view, or remove patients."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Patients' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <form onSubmit={onSearch} style={{ display: 'flex', gap: 8 }}>
              <TextInput
                icon="search"
                placeholder="Search name, email, or phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-secondary">Search</button>
              <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Icon name="plus" size={14} /> Add patient
              </button>
            </form>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <table className="table" aria-hidden="true">
              <thead>
                <tr><th>Patient</th><th>Email</th><th>Phone</th><th>Gender</th><th></th></tr>
              </thead>
              <tbody><SkeletonRows rows={8} cols={5} /></tbody>
            </table>
          </div>
        ) : error ? (
          <ErrorState title="Could not load patients" message={error} onRetry={load} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon="users-round"
            title={query ? 'No matching patients' : 'No patients yet'}
            message={query ? 'Try a different search.' : 'Add the first patient to the registry.'}
          />
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr><th>Patient</th><th>Email</th><th>Phone</th><th>Gender</th><th></th></tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.full_name}</strong></td>
                    <td className="t-muted">{p.email || '—'}</td>
                    <td className="t-muted">{p.phone || '—'}</td>
                    <td className="t-muted">{p.gender || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost sm" onClick={() => setViewing(p)} title="View record">
                        <Icon name="eye" size={14} />
                      </button>
                      <button className="btn btn-ghost sm" onClick={() => { setEditing(p); setFormOpen(true); }} title="Edit">
                        <Icon name="pencil" size={14} />
                      </button>
                      <button className="btn btn-ghost sm" onClick={() => setDeleting(p)} title="Delete">
                        <Icon name="trash-2" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body">
              <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE_SIZE} label="patients" />
            </div>
          </div>
        )}
      </div>

      <PatientFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        initial={editing}
        onSaved={load}
      />
      <PatientRecordsModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        patient={viewing}
      />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        loading={deleteBusy}
        title="Delete patient?"
        message={`This will permanently remove ${deleting?.full_name || 'this patient'} from the registry.`}
        confirmLabel="Delete patient"
      />
    </AppShell>
  );
}

export { PatientsMgmt };
