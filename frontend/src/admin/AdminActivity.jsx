// AdminActivity — audit trail (Phase 6).
// Prototype UI restored: search + role-chip toolbar, avatar list rows with
// human-readable actions, 6-per-page client pagination.
// Real API: getAdminActivity (fetched once at limit 100, filtered and
// paginated client-side).
// Entry shape: { id, actor, action, detail, created_at } — actor is a
// name/email string, action is a snake_case code (e.g. 'doctor.create',
// 'auth.login.success'), detail is a human-readable string.
import { useEffect, useState } from 'react';
import {
  AppShell, EmptyState, ErrorState, Icon, PageHeader, Pagination,
} from '../shared/components.jsx';
import { getAdminActivity } from '../shared/api.js';
import { localToday } from './helpers.js';

const PAGE = 6;

// snake_case action codes → human readable, e.g. 'auth.login.success' →
// 'Auth login success', 'doctor.create' → 'Doctor create'.
const humanAction = (action) =>
  String(action || '').replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function AdminActivity() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [who, setWho] = useState('all');
  const [page, setPage] = useState(1);
  const todayISO = localToday();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await getAdminActivity({ limit: 100 });
      setEntries(r.entries || []);
    } catch (err) {
      setError(err.message || 'Could not load activity log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filters: text search (action/detail/actor) + "who did it" chips. Console
  // actions are written by the signed-in admin (staff). Auth events carry the
  // account kind in the detail ("patient:<id>", "doctor:<id>", "admin:<id>"),
  // which is how doctor/patient actions are recognized. Anything unrecognized
  // falls back to staff, since the only writer outside auth events is the
  // console — same fallback rule as the prototype's roleOf.
  const roleOf = (e) => {
    if (String(e.action || '').startsWith('auth.')) {
      const kind = /^([a-z]+):/.exec(e.detail || '')?.[1];
      if (kind === 'doctor') return 'doctor';
      if (kind === 'patient') return 'patient';
    }
    return 'staff';
  };
  const filtered = entries.filter((e) => {
    if (who !== 'all' && roleOf(e) !== who) return false;
    if (!query) return true;
    const hay = `${e.action || ''} ${e.detail || ''} ${e.actor || ''}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });
  const filtersActive = who !== 'all' || query.trim() !== '';
  const whoFilters = [
    ['all', 'All'],
    ['staff', 'Staff'],
    ['doctor', 'Doctors'],
    ['patient', 'Patients'],
  ];

  // A search/filter change can move the current page out of range
  useEffect(() => { setPage(1); }, [query, who]);
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <AppShell current="a-activity">
      <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
        <PageHeader
          title="Activity log"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 220, maxWidth: '100%', height: 14 }} />
            : (filtersActive
              ? `${filtered.length} of ${entries.length} actions shown · newest first`
              : `${entries.length} action${entries.length === 1 ? '' : 's'} · newest first`)}
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Activity log' }]}
        />

        {/* Search + who-did-it filter chips */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar">
            <div className="input-group search">
              <Icon name="search" size={16} className="input-icon" />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search action, name, or detail…" aria-label="Search activity by action, name, or detail" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {whoFilters.map(([key, label]) => (
                <button key={key} type="button" className={'chip filter' + (who === key ? ' on' : '')} onClick={() => setWho(key)}>{label}</button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> of {entries.length} matching
            </div>
          </div>
        </div>

        {error ? (
          <ErrorState title="Could not load activity log" message={error} onRetry={load} />
        ) : (
          <div className="card">
            <div>
              {loading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="list-item" aria-hidden="true">
                    <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                    <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="skel" style={{ height: 10, width: '35%' }} />
                      <span className="skel" style={{ height: 10, width: '65%' }} />
                    </div>
                    <span className="skel" style={{ width: 64, height: 11, flexShrink: 0 }} />
                  </div>
                ))
              ) : entries.length === 0 ? (
                <EmptyState icon="activity" title="No activity yet" message="Actions from the console, doctor portal, and patient bookings will appear here." />
              ) : filtered.length === 0 ? (
                <EmptyState icon="filter" title="No actions match your filters"
                  message="Try a different search term or filter."
                  actions={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(''); setWho('all'); }}>Clear filters</button>} />
              ) : paged.map((e) => {
                const d = new Date(e.created_at);
                const pad = (x) => String(x).padStart(2, '0');
                const dayISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                // Today's entries show just the time; older ones get the date too
                const label = dayISO === todayISO ? time : `${window.formatDate(dayISO)} · ${time}`;
                const actor = e.actor || 'System';
                const detail = e.detail || '';
                return (
                  <div key={e.id} className="list-item">
                    <div className="avatar">{window.initials(actor)}</div>
                    <div className="list-item-body">
                      <div className="list-item-title">{humanAction(e.action)}</div>
                      <div className="list-item-sub">{detail ? `${detail} · ` : ''}{actor}</div>
                    </div>
                    <span className="t-mono" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <Pagination page={page} setPage={setPage} total={filtered.length} pageSize={PAGE} label="actions" />
        )}

        <p className="t-muted" style={{ fontSize: 12, marginTop: 12 }}>
          Every action taken in the admin console is recorded here, newest first.
        </p>
      </div>
    </AppShell>
  );
}

export { AdminActivity };
