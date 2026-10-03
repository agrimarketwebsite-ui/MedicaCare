// AdminActivity — audit trail (Phase 6).
// Filter (actor/action/date from-to) + paginated table.
// Entry shape: { id, actor_name, actor_role, action, entity_type, entity_id,
//   details, created_at }.
import { useEffect, useState } from 'react';
import {
  AppShell, EmptyState, ErrorState, Field, PageHeader,
  Pagination, SelectInput, SkeletonRows, TextInput,
} from '../shared/components.jsx';
import { getAdminActivity } from '../shared/api.js';

const PAGE_SIZE = 20;
const ACTIONS = [
  '', 'patient.created', 'patient.updated', 'patient.deleted',
  'doctor.created', 'doctor.updated', 'doctor.deleted',
  'doctor.access.granted', 'doctor.access.revoked', 'doctor.access.reset',
  'appointment.created', 'appointment.updated', 'appointment.status_changed',
  'appointment.deleted', 'story.approved', 'story.rejected', 'story.unpublished',
  'ticket.replied', 'ticket.resolved', 'settings.updated',
];

function AdminActivity() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ actor: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminActivity({ ...filters, page, limit: PAGE_SIZE });
      setEntries(r.entries);
      setTotal(r.total);
    } catch (err) {
      setError(err.message || 'Could not load activity log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppShell current="a-activity">
      <div className="page">
        <PageHeader
          title="Activity log"
          subtitle="Every admin action, recorded."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Activity log' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <form onSubmit={applyFilters} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label="Actor">
                <TextInput
                  value={filters.actor}
                  onChange={set('actor')}
                  placeholder="Name or email…"
                  style={{ minWidth: 160 }}
                />
              </Field>
              <Field label="Action">
                <SelectInput value={filters.action} onChange={set('action')} style={{ minWidth: 190 }}>
                  <option value="">All actions</option>
                  {ACTIONS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
                </SelectInput>
              </Field>
              <Field label="From">
                <TextInput type="date" value={filters.from} onChange={set('from')} />
              </Field>
              <Field label="To">
                <TextInput type="date" value={filters.to} onChange={set('to')} />
              </Field>
              <button type="submit" className="btn btn-secondary">Filter</button>
            </form>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <table className="table" aria-hidden="true">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody><SkeletonRows rows={10} cols={4} /></tbody>
            </table>
          </div>
        ) : error ? (
          <ErrorState title="Could not load activity log" message={error} onRetry={load} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon="history"
            title="No activity found"
            message="Actions you take in the admin console will be recorded here."
          />
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="t-muted" style={{ whiteSpace: 'nowrap' }}>
                      {(e.created_at || '').slice(0, 16).replace('T', ' ')}
                    </td>
                    <td>
                      <strong>{e.actor_name || '—'}</strong>
                      {e.actor_role && <div className="t-muted" style={{ fontSize: 12 }}>{e.actor_role}</div>}
                    </td>
                    <td><code style={{ fontSize: 12.5 }}>{e.action}</code></td>
                    <td className="t-muted" style={{ fontSize: 13, maxWidth: 380 }}>
                      {e.details || (e.entity_type ? `${e.entity_type}${e.entity_id ? ` · ${e.entity_id}` : ''}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body">
              <Pagination page={page} setPage={setPage} total={total} pageSize={PAGE_SIZE} label="entries" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export { AdminActivity };
