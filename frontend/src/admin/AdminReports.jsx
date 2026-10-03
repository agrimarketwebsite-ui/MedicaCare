// AdminReports — stats, specialty breakdown, busiest doctors, CSV export
// (Phase 6). Ang byDay chart ay BarChart mula sa ./charts.jsx.
import { useEffect, useState } from 'react';
import {
  AppShell, EmptyState, ErrorState, Icon, PageHeader, SkeletonRows, useStore,
} from '../shared/components.jsx';
import { exportCsvReport, getBusiestDoctors, getReportStats, getSpecialtyBreakdown, ApiError } from '../shared/api.js';
import { BarChart } from './charts.jsx';

function AdminReports() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [busiest, setBusiest] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getReportStats(), getSpecialtyBreakdown(), getBusiestDoctors()])
      .then(([r, b, d]) => {
        if (cancelled) return;
        setReport(r);
        setBreakdown(b);
        setBusiest(d);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load reports.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  const doExport = async () => {
    setExporting(true);
    try {
      const { filename } = await exportCsvReport();
      store.pushToast({ kind: 'success', title: 'Report exported', message: `${filename} was downloaded.` });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Export failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  const stats = report?.stats || {};

  return (
    <AppShell current="reports">
      <div className="page">
        <PageHeader
          title="Reports"
          subtitle="Clinic performance and booking statistics."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Reports' }]}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="t-muted" style={{ fontSize: 13 }}>
              Download the full report as a CSV file (formula-injection-safe).
            </div>
            <button className="btn btn-primary" onClick={doExport} disabled={exporting || loading}>
              <Icon name="download" size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <div className="card-body">
              <table className="table" aria-hidden="true">
                <tbody><SkeletonRows rows={6} cols={3} /></tbody>
              </table>
            </div>
          </div>
        ) : error ? (
          <ErrorState title="Could not load reports" message={error} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                ['Total patients', stats.patients],
                ['Total doctors', stats.doctors],
                ['Total appointments', stats.appointments],
                ['Appointments today', stats.appointmentsToday],
              ].map(([label, value]) => (
                <div className="card" key={label}>
                  <div className="card-body">
                    <div className="stat-num">{value ?? '—'}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <h3 style={{ margin: '0 0 12px' }}>Appointments per day</h3>
                {(report.byDay || []).length === 0
                  ? <EmptyState icon="bar-chart-3" title="No appointment data yet" message="Daily counts will appear here." />
                  : <BarChart data={report.byDay} />}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card">
                <div className="card-body">
                  <h3 style={{ margin: '0 0 12px' }}>Appointments by specialty</h3>
                  {breakdown.length === 0 ? (
                    <EmptyState icon="pie-chart" title="No breakdown yet" message="Per-specialty data will appear here." />
                  ) : (
                    <table className="table">
                      <thead><tr><th>Specialty</th><th>Doctors</th><th>Appointments</th></tr></thead>
                      <tbody>
                        {breakdown.map((b, i) => (
                          <tr key={b.specialty || i}>
                            <td><strong>{b.specialty || '—'}</strong></td>
                            <td className="t-muted">{b.doctors ?? '—'}</td>
                            <td className="t-muted">{b.appointments ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <h3 style={{ margin: '0 0 12px' }}>Busiest doctors</h3>
                  {busiest.length === 0 ? (
                    <EmptyState icon="trophy" title="No data yet" message="Doctor booking counts will appear here." />
                  ) : (
                    <table className="table">
                      <thead><tr><th>Doctor</th><th>Specialty</th><th>Appointments</th></tr></thead>
                      <tbody>
                        {busiest.map((d) => (
                          <tr key={d.id}>
                            <td><strong>{d.full_name}</strong></td>
                            <td className="t-muted">{d.specialty_name || '—'}</td>
                            <td className="t-muted">{d.appointment_count ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export { AdminReports };
