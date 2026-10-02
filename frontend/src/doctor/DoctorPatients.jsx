// DoctorPatients — doctor (Phase 5)
// Mga pasyenteng may appointment sa doctor na ito (hindi buong directory).
// Ang pag-click ay nagbubukas ng PatientHistoryModal (visit history +
// records + amended notes).
import { useEffect, useState } from 'react';
import { AppShell, EmptyState, ErrorState, Icon, PageHeader, TextInput, useStore } from '../shared/components.jsx';
import { getDoctorPatients } from '../shared/api.js';
import { PatientHistoryModal } from './PatientHistoryModal.jsx';

function DoctorPatients() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDoctorPatients()
      .then((list) => { if (!cancelled) { setPatients(list); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Could not load patients.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [retryKey]);

  const q = query.trim().toLowerCase();
  const filtered = patients.filter(p =>
    !q || p.full_name.toLowerCase().includes(q) || (p.phone || '').includes(q),
  );

  return (
    <AppShell current="d-patients">
      <div className="page">
        <PageHeader
          title="My patients"
          subtitle="Patients with appointments under your care."
          breadcrumbs={[{ label: 'Home', to: '/doctor' }, { label: 'My patients' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <TextInput
              icon="search"
              placeholder="Search name or phone…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="card"><div className="card-body"><p className="t-muted" style={{ fontSize: 13.5 }}>Loading patients…</p></div></div>
        ) : error ? (
          <ErrorState title="Could not load patients" message={error} onRetry={() => setRetryKey(k => k + 1)} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users-round"
            title={q ? 'No matching patients' : 'No patients yet'}
            message={q ? 'Try a different search.' : 'Patients with bookings will appear here.'}
          />
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr><th>Patient</th><th>Contact</th><th>Visits</th><th>Last visit</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.full_name}</strong></td>
                    <td className="t-muted">{p.phone || '—'}</td>
                    <td>{p.visit_count}</td>
                    <td className="t-muted">{p.last_visit_date || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary sm" onClick={() => setSelected(p)}>
                        <Icon name="history" size={14} /> History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PatientHistoryModal
        open={!!selected}
        onClose={() => setSelected(null)}
        patient={selected}
      />
    </AppShell>
  );
}

export { DoctorPatients };
export default DoctorPatients;
