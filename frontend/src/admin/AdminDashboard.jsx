// AdminDashboard — overview ng admin console (Phase 6).
// GET /api/admin/reports/stats → { stats, byDay }.
// Assumed shape (backend implements the same):
//   { stats: { patients, doctors, appointments, appointmentsToday,
//              pendingStories, openTickets },
//     byDay: [{ label, value }] } — appointments per day (last 7 days).
import { useEffect, useState } from 'react';
import { AppShell, EmptyState, ErrorState, PageHeader, SkeletonRows } from '../shared/components.jsx';
import { getReportStats } from '../shared/api.js';
import { BarChart } from './charts.jsx';

function StatCard({ label, value }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="stat-num">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getReportStats()
      .then((d) => { if (!cancelled) { setReport(d); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Could not load dashboard stats.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [retryKey]);

  const stats = report?.stats || {};

  return (
    <AppShell current="a-dashboard">
      <div className="page">
        <PageHeader
          title="Dashboard"
          subtitle="Clinic overview at a glance."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Dashboard' }]}
        />

        {loading ? (
          <div className="card">
            <div className="card-body">
              <table className="table" aria-hidden="true">
                <tbody><SkeletonRows rows={4} cols={2} /></tbody>
              </table>
            </div>
          </div>
        ) : error ? (
          <ErrorState title="Could not load dashboard" message={error} onRetry={() => setRetryKey(k => k + 1)} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
              <StatCard label="Patients" value={stats.patients} />
              <StatCard label="Doctors" value={stats.doctors} />
              <StatCard label="Appointments" value={stats.appointments} />
              <StatCard label="Appointments today" value={stats.appointmentsToday} />
              <StatCard label="Pending stories" value={stats.pendingStories} />
              <StatCard label="Open tickets" value={stats.openTickets} />
            </div>
            <div className="card">
              <div className="card-body">
                <h3 style={{ margin: '0 0 12px' }}>Appointments per day</h3>
                {(report.byDay || []).length === 0 ? (
                  <EmptyState icon="bar-chart-3" title="No appointment data yet" message="Daily counts will appear here." />
                ) : (
                  <BarChart data={report.byDay} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export { AdminDashboard };
