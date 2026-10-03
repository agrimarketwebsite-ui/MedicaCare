// StoriesMgmt — patient story moderation (Phase 6).
// Three-section layout restored from the prototype: "Waiting for review",
// "Approved & shown publicly", "Not published". Search filters the quote and
// display name client-side.
// Story shape: { id, display_name, quote, status, reviewed_at, created_at }.
// NOTE: the prototype's StoryRow also showed the author's account identity
// (name + email) for staff verification, but the API does not return patient
// identity for stories, so only the public display name can be shown.
import { useEffect, useState } from 'react';
import {
  AppShell, EmptyState, ErrorState, Icon, PageHeader, PatientAvatar, useStore,
} from '../shared/components.jsx';
import { formatDate } from '../shared/data.js';
import { approveStory, getAdminStories, rejectStory, unpublishStory, ApiError } from '../shared/api.js';

// ---------- Patient stories (public testimonial moderation) ----------
// Portal submissions land here as pending; approved ones are shown on the
// public "What patients say" carousel under the display name only.
function StoryRow({ t, actions }) {
  const displayName = t.display_name || 'Anonymous';
  return (
    <div className="list-item" style={{ alignItems: 'flex-start' }}>
      <PatientAvatar person={{ name: displayName }} size={28} />
      <div className="list-item-body">
        <div className="list-item-title">"{t.quote}"</div>
        <div className="list-item-sub">
          Shows as "{displayName}" · submitted {formatDate((t.created_at || '').slice(0, 10))}
          {t.reviewed_at ? ` · reviewed ${formatDate((t.reviewed_at || '').slice(0, 10))}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

function StoriesMgmt() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stories, setStories] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getAdminStories('');
      setStories(list);
    } catch (err) {
      setError(err.message || 'Could not load stories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  // Search spans the quote and the display name (the API returns no patient
  // identity for stories, so it cannot be searched)
  const matches = (t) => {
    if (!q) return true;
    return `${t.quote || ''} ${t.display_name || ''}`.toLowerCase().includes(q);
  };
  const pending = stories.filter((t) => t.status === 'pending').filter(matches);
  const approved = stories.filter((t) => t.status === 'approved').filter(matches);
  const rejected = stories.filter((t) => t.status === 'rejected').filter(matches);

  const act = async (id, fn, title, msg) => {
    setBusyId(id);
    try {
      await fn(id);
      // NOTE: ToastLayer reads `t.msg` — `message` would render an empty body
      store.pushToast({ kind: 'success', title, msg });
      load();
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Action failed', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  // Skeleton rows mirroring the StoryRow layout (avatar + quote + meta line)
  const storySkeletons = (count) => Array.from({ length: count }).map((_, i) => (
    <div key={i} className="list-item" aria-hidden="true">
      <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
      <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="skel" style={{ height: 11, width: '70%' }} />
        <span className="skel" style={{ height: 10, width: '85%' }} />
      </div>
      <span className="skel" style={{ width: 74, height: 22, borderRadius: 'var(--r-pill)', flexShrink: 0 }} />
    </div>
  ));

  return (
    <AppShell current="stories">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="Patient stories"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 340, maxWidth: '100%', height: 14 }} />
            : `${pending.length} waiting for review · ${approved.length} shown on the public website`}
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Patient stories' }]}
        />

        {error ? (
          <div className="card">
            <ErrorState title="Could not load stories" message={error} onRetry={() => setRetryKey((k) => k + 1)} />
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="table-toolbar">
                <div className="input-group search">
                  <Icon name="search" size={16} className="input-icon" />
                  <input
                    className="input"
                    style={{ paddingLeft: 38 }}
                    placeholder="Search by quote, display name, or patient…"
                    aria-label="Search stories by quote, display name, or patient"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>{pending.length + approved.length + rejected.length}</strong> matching
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2 className="h-section">Waiting for review</h2>
              </div>
              <div>
                {loading ? (
                  storySkeletons(2)
                ) : pending.length === 0 ? (
                  <div style={{ padding: '8px 20px 16px' }}>
                    <EmptyState
                      icon="message-square"
                      title="No stories waiting for review"
                      message="Stories submitted from the patient portal (Help & support) appear here for approval before they are shown on the public website."
                    />
                  </div>
                ) : pending.map((t) => (
                  <StoryRow key={t.id} t={t} actions={<>
                    <button
                      className="btn btn-primary sm"
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, approveStory, 'Story approved', 'It is now shown on the public website.')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger-outline sm"
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, rejectStory, 'Story rejected', 'It will not appear on the public website.')}
                    >
                      Reject
                    </button>
                  </>} />
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h2 className="h-section">Approved & shown publicly</h2>
              </div>
              <div>
                {loading ? (
                  storySkeletons(1)
                ) : approved.length === 0 ? (
                  <div style={{ padding: '8px 20px 16px' }}>
                    <EmptyState
                      icon="globe"
                      title="Nothing published yet"
                      message="Approved stories appear on the public website's What patients say carousel."
                    />
                  </div>
                ) : approved.map((t) => (
                  <StoryRow key={t.id} t={t} actions={
                    <button
                      className="btn btn-secondary sm"
                      disabled={busyId === t.id}
                      onClick={() => act(t.id, unpublishStory, 'Story unpublished', 'It is back in the review queue.')}
                    >
                      Unpublish
                    </button>
                  } />
                ))}
              </div>
            </div>

            {rejected.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h2 className="h-section">Not published</h2>
                </div>
                <div>
                  {rejected.map((t) => (
                    <StoryRow key={t.id} t={t} actions={
                      <button
                        className="btn btn-secondary sm"
                        disabled={busyId === t.id}
                        onClick={() => act(t.id, unpublishStory, 'Story unpublished', 'It is back in the review queue.')}
                      >
                        Restore to review
                      </button>
                    } />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

export { StoryRow, StoriesMgmt };
