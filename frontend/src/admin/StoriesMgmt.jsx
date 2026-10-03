// StoriesMgmt — patient story moderation (Phase 6).
// Status filter (SelectInput sa table-toolbar) + approve / reject / unpublish.
// Story shape: { id, title, body, patient_name?, status, created_at }.
import { useEffect, useState } from 'react';
import {
  AppShell, Badge, EmptyState, ErrorState, Icon, PageHeader,
  SelectInput, SkeletonRows, useStore,
} from '../shared/components.jsx';
import { approveStory, getAdminStories, rejectStory, unpublishStory, ApiError } from '../shared/api.js';

function statusBadge(status) {
  if (status === 'approved') return <Badge kind="success">Approved</Badge>;
  if (status === 'rejected') return <Badge kind="danger">Rejected</Badge>;
  return <Badge kind="neutral">Pending</Badge>;
}

function StoriesMgmt() {
  const store = useStore();
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stories, setStories] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getAdminStories(status);
      setStories(list);
    } catch (err) {
      setError(err.message || 'Could not load stories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, fn, title, message) => {
    setBusyId(id);
    try {
      await fn(id);
      store.pushToast({ kind: 'success', title, message });
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Action failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell current="stories">
      <div className="page">
        <PageHeader
          title="Patient stories"
          subtitle="Moderate patient testimonials shown on the public site."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Patient stories' }]}
        />

        <div className="card">
          <div className="table-toolbar">
            <SelectInput
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter stories by status"
              style={{ maxWidth: 190 }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </SelectInput>
          </div>

          {loading ? (
            <table className="table" aria-hidden="true">
              <tbody><SkeletonRows rows={6} cols={4} /></tbody>
            </table>
          ) : error ? (
            <ErrorState title="Could not load stories" message={error} onRetry={load} />
          ) : stories.length === 0 ? (
            <EmptyState
              icon="message-square"
              title="No stories found"
              message={status === 'pending' ? 'New patient submissions will appear here for review.' : 'Try a different status filter.'}
            />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Story</th><th>Patient</th><th>Submitted</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title || 'Untitled'}</strong>
                      <div className="t-muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 420 }}>
                        {(s.body || '').slice(0, 140)}{(s.body || '').length > 140 ? '…' : ''}
                      </div>
                    </td>
                    <td className="t-muted">{s.patient_name || '—'}</td>
                    <td className="t-muted">{(s.created_at || '').slice(0, 10)}</td>
                    <td>{statusBadge(s.status)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {s.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-secondary sm"
                            disabled={busyId === s.id}
                            onClick={() => act(s.id, approveStory, 'Story approved', 'The story is now visible on the public site.')}
                          >
                            <Icon name="check" size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-ghost sm"
                            disabled={busyId === s.id}
                            onClick={() => act(s.id, rejectStory, 'Story rejected', 'The story was rejected.')}
                          >
                            <Icon name="x" size={14} /> Reject
                          </button>
                        </>
                      )}
                      {s.status === 'approved' && (
                        <button
                          className="btn btn-ghost sm"
                          disabled={busyId === s.id}
                          onClick={() => act(s.id, unpublishStory, 'Story unpublished', 'The story was removed from the public site.')}
                        >
                          <Icon name="eye-off" size={14} /> Unpublish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export { StoriesMgmt };
