// DoctorFeedback — doctor portal
// The full ratings list moved off the dashboard into its own page.
import { useEffect, useState } from 'react';
import { AppShell, DoctorRatingPill, EmptyState, ErrorState, Icon, PageHeader, useStore } from '../shared/components.jsx';
import { getDoctorFeedback } from '../shared/api.js';
import { fmtDateLong } from './helpers.js';
import { useDoctor } from './helpers.js';

function DoctorFeedback() {
  const store = useStore();
  const me = useDoctor();
  // Simulated fetch — skeleton rows while "loading", same 600ms pattern as
  // the other portal pages (dashboard, My patients, admin list pages)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratings, setRatings] = useState([]);
  const [avg, setAvg] = useState(null);
  const [count, setCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDoctorFeedback()
      .then((d) => {
        if (cancelled) return;
        setRatings(d.ratings || []);
        setAvg(d.avg_rating);
        setCount(Number(d.rating_count) || 0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load feedback.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  const sorted = ratings.slice().sort((a, b) =>
    String(b.created_at || b.visit_date || '').localeCompare(String(a.created_at || a.visit_date || '')));

  return (
    <AppShell current="d-feedback">
      {/* Centered container (per design direction) — header + feedback card
          share the same 860px column, like the patient portal's narrow pages */}
      <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
        <PageHeader
          title="Patient feedback"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 240, maxWidth: '100%', height: 14 }} />
            : 'Ratings and comments from your completed visits.'}
          breadcrumbs={[{ label: 'Doctor portal', to: '/doctor/dashboard' }, { label: 'Patient feedback' }]}
          actions={loading
            ? /* Skeleton rating pill — mirrors the DoctorRatingPill footprint
                 so the header row doesn't jump when the data lands */
              <span className="skel" aria-hidden="true" style={{ display: 'inline-block', width: 128, height: 22, borderRadius: 'var(--r-pill)' }} />
            : <DoctorRatingPill avg={avg} count={count} />}
        />

        <div className="card">
          <div>
            {loading ? (
              // Skeleton rows mirroring the real rating rows (stars + who/when
              // line + comment line) so there is no layout shift
              [0, 1, 2].map(i => (
                <div key={i} className="list-item" aria-hidden="true">
                  <span className="skel" style={{ width: 86, height: 14, flexShrink: 0 }} />
                  <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="skel" style={{ height: 11, width: '45%' }} />
                    <span className="skel" style={{ height: 10, width: '70%' }} />
                  </div>
                </div>
              ))
            ) : error ? (
              <div style={{ padding: '8px 20px 16px' }}>
                <ErrorState title="Could not load feedback" message={error} onRetry={() => setRetryKey(k => k + 1)} />
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: '8px 20px 16px' }}>
                <EmptyState icon="star" title="No ratings yet"
                  message="Patients can rate your visit once it is completed. Their feedback will appear here." />
              </div>
            ) : sorted.map(r => {
              // Review-page hierarchy: who rated leads, the comment follows.
              // "No comment left" as the row headline made empty states the
              // loudest thing on the page (repeated on every comment-less row)
              return (
                <div key={r.id} className="list-item">
                  <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0, marginTop: 2 }} aria-label={`${r.stars} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <Icon key={n} name="star" size={14} className={n <= r.stars ? 'star-on' : 'star-off'} />
                    ))}
                  </span>
                  <div className="list-item-body">
                    <div className="list-item-title">
                      {r.patient_name || 'Patient'}
                      <span className="t-muted" style={{ fontWeight: 400 }}> · {r.visit_date ? fmtDateLong(r.visit_date) : ''}</span>
                    </div>
                    <div className="list-item-sub" style={r.comment ? { color: 'var(--text-secondary)', fontSize: 13 } : { fontStyle: 'italic' }}>
                      {r.comment || 'No comment left'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="t-help" style={{ padding: '10px 20px 16px', margin: 0 }}>
            Ratings come from patients with completed visits (one per visit).
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export { DoctorFeedback };
export default DoctorFeedback;
