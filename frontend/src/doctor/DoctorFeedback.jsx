// DoctorFeedback — doctor (Phase 5)
// Patient feedback: sariling visit_ratings + average/count mula sa
// v_doctor_rating_averages. Walang per-patient PII lampas sa pangalan.
import { useEffect, useState } from 'react';
import { AppShell, EmptyState, ErrorState, Icon, PageHeader } from '../shared/components.jsx';
import { getDoctorFeedback } from '../shared/api.js';
import { fmtDateLong, starsDisplay } from './helpers.js';

function DoctorFeedback() {
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

  return (
    <AppShell current="d-feedback">
      <div className="page">
        <PageHeader
          title="Patient feedback"
          subtitle="What your patients say about their visits."
          breadcrumbs={[{ label: 'Home', to: '/doctor' }, { label: 'Patient feedback' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--warning, #b45309)' }}>
              {loading
                ? <span className="skel" aria-hidden="true" style={{ width: 72, height: 40, display: 'inline-block', verticalAlign: 'middle' }} />
                : avg !== null ? Number(avg).toFixed(1) : '—'}
            </div>
            <div>
              <div style={{ fontSize: 20, letterSpacing: 2, color: '#d97706' }}>
                {loading ? <span className="skel" aria-hidden="true" style={{ width: 110, height: 20, display: 'inline-block', verticalAlign: 'middle' }} /> : starsDisplay(avg || 0)}
              </div>
              <div className="t-muted" style={{ fontSize: 13 }}>
                {loading
                  ? <span className="skel" aria-hidden="true" style={{ width: 140, height: 12, display: 'inline-block', verticalAlign: 'middle' }} />
                  : count === 0 ? 'No ratings yet' : `Based on ${count} rating${count === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="stack md" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span className="skel" style={{ width: 90, height: 15, display: 'block' }} />
                    <span className="skel" style={{ width: 130, height: 14, display: 'block' }} />
                    <span className="skel" style={{ width: 100, height: 11, display: 'block' }} />
                  </div>
                  <span className="skel" style={{ width: '85%', height: 12, display: 'block' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Could not load feedback" message={error} onRetry={() => setRetryKey(k => k + 1)} />
        ) : ratings.length === 0 ? (
          <EmptyState icon="star" title="No feedback yet" message="Ratings from completed visits will appear here." />
        ) : (
          <div className="stack md">
            {ratings.map(r => (
              <div key={r.id} className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ color: '#d97706', letterSpacing: 1.5, fontSize: 15 }}>{starsDisplay(r.stars)}</div>
                    <strong>{r.patient_name || 'Patient'}</strong>
                    <span className="t-muted" style={{ fontSize: 12.5 }}>
                      {r.visit_date ? fmtDateLong(r.visit_date) : ''}
                    </span>
                  </div>
                  {r.comment && (
                    <p style={{ fontSize: 14, marginTop: 8, marginBottom: 0, fontStyle: 'italic' }}>
                      “{r.comment}”
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="t-muted" style={{ fontSize: 12, marginTop: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="info" size={13} />
          Only you can see individual ratings here; the public directory shows the aggregate average.
        </p>
      </div>
    </AppShell>
  );
}

export { DoctorFeedback };
export default DoctorFeedback;
