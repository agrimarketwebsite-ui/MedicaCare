// AdminReports — clinic reports (restored prototype UI, real API).
// Stat cards with sparklines + specialty bar chart + busiest doctors list +
// breakdown table + CSV export.
import { useEffect, useState } from 'react';
import {
  AppShell, DoctorAvatar, EmptyState, ErrorState, Icon, MiniBarChart,
  PageHeader, SkeletonRows, Sparkline, useStore,
} from '../shared/components.jsx';
import { getAdminAppointments, getAdminDoctors } from '../shared/api.js';
import { downloadCSV } from './helpers.js';

// ---------- Reports ----------
function AdminReports() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      getAdminAppointments({ limit: 100 }),
      getAdminDoctors('', 1, 1000),
    ])
      .then(([appts, docs]) => {
        if (cancelled) return;
        setAppointments(appts.appointments || []);
        setDoctors(docs.doctors || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load reports.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]);

  const appts = appointments;
  const apptDate = (a) => (a.appointment_date || '').slice(0, 10);

  const completed = appts.filter(a => a.status === 'completed').length;
  const cancelled = appts.filter(a => ['cancelled', 'no-show'].includes(a.status)).length;
  const completionRate = appts.length ? Math.round((completed / appts.length) * 100) : 0;
  const cancellationRate = appts.length ? ((cancelled / appts.length) * 100).toFixed(1) : '0.0';

  const now = new Date();
  const dayCounts = (list, dateKey) => {
    const counts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      counts.push(list.filter(x => (x[dateKey] || '').slice(0, 10) === iso).length);
    }
    return counts.some(c => c > 0) ? counts : null;
  };
  const dayRate = (statusList) => {
    const totals = dayCounts(appts, 'appointment_date');
    if (!totals) return null;
    const matched = dayCounts(appts.filter(a => statusList.includes(a.status)), 'appointment_date') || totals.map(() => 0);
    return totals.map((t, i) => (t ? Math.round((matched[i] / t) * 100) : 0));
  };

  const stats = [
    { label: 'Total appointments', value: appts.length, icon: 'calendar-days', tone: 'success', trend: dayCounts(appts, 'appointment_date') },
    { label: 'Completed visits', value: completed, icon: 'check-circle-2', tone: 'success', trend: dayCounts(appts.filter(a => a.status === 'completed'), 'appointment_date') },
    { label: 'Completion rate', value: `${completionRate}%`, icon: 'trending-up', tone: 'success', trend: dayRate(['completed']) },
    { label: 'Cancellation rate', value: `${cancellationRate}%`, icon: 'x-circle', tone: 'error', trend: dayRate(['cancelled', 'no-show']) },
  ];

  // Doctor lookup for specialty/fee
  const doctorById = {};
  for (const d of doctors) doctorById[d.id] = d;
  const specialtyOf = (d) => d?.specialties?.name || d?.specialty_name || 'Unknown';

  // Appointments per specialty
  const specMap = {};
  for (const a of appts) {
    const d = doctorById[a.doctor_id];
    const sp = specialtyOf(d);
    if (!specMap[sp]) specMap[sp] = { specialty: sp, total: 0, completed: 0, cancelled: 0, revenue: 0 };
    specMap[sp].total++;
    if (a.status === 'completed') {
      specMap[sp].completed++;
      specMap[sp].revenue += Number(d?.consultation_fee) || 0;
    }
    if (['cancelled', 'no-show'].includes(a.status)) specMap[sp].cancelled++;
  }
  const bySpecialty = Object.values(specMap)
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const chartData = bySpecialty.slice(0, 6).map(r => ({ label: r.specialty, value: r.total }));
  const peak = chartData.length ? Math.max(...chartData.map(d => d.value)) : 0;

  // Busiest doctors by appointment count (3 rows)
  const byDoctor = doctors
    .map(d => ({ ...d, count: appts.filter(a => a.doctor_id === d.id).length }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const doExport = () => {
    downloadCSV('medicacare-reports-by-specialty.csv', [
      ['Specialty', 'Appointments', 'Completed', 'Cancelled', 'Revenue (completed)'],
      ...bySpecialty.map(r => [r.specialty, r.total, r.completed, r.cancelled, r.revenue]),
    ]);
    store.pushToast({ kind: 'success', title: 'Export ready', message: 'Specialty breakdown exported to CSV.' });
  };

  return (
    <AppShell current="reports">
      <div className="page">
        <PageHeader
          title="Reports"
          subtitle="Appointment activity across specialties and doctors."
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Reports' }]}
          actions={<button className="btn btn-secondary" onClick={doExport}><Icon name="download" size={14} /> Export CSV</button>}
        />

        {error ? (
          <ErrorState title="Could not load reports" message={error} onRetry={() => setRetryKey(k => k + 1)} />
        ) : (
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              {stats.map((s, i) => (
                <div key={i} className={'card stat-card' + (s.trend ? ' stat-card-spark' : '')}>
                  {loading ? (
                    <>
                      <span className="skel" style={{ height: 12, width: '70%' }} />
                      <span className="skel" style={{ height: 26, width: '32%' }} />
                      <span className="skel" style={{ height: 22, width: '40%' }} />
                    </>
                  ) : (
                    <>
                      <div className="stat-label"><Icon name={s.icon} size={14} /> {s.label}</div>
                      <div className="stat-row">
                        <div className="stat-value">{s.value}</div>
                        {s.trend && <Sparkline data={s.trend} tone={s.tone} delay={350 + i * 200} />}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="two-col" style={{ marginBottom: 20 }}>
              <div className="card">
                <div className="card-header"><h2 className="h-section">Appointments by specialty</h2></div>
                <div className="card-body">
                  {loading ? (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="spinner" role="status" aria-label="Loading chart" />
                    </div>
                  ) : chartData.length === 0 ? (
                    <EmptyState icon="bar-chart-3" title="No appointment data yet" message="The specialty chart will appear once appointments are booked." />
                  ) : (
                    <MiniBarChart
                      data={chartData.map(d => ({ ...d, highlight: d.value === peak }))}
                      height={160} trend delay={350}
                    />
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h2 className="h-section">Busiest doctors</h2></div>
                <div>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="list-item">
                        <span className="skel" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                        <div className="list-item-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="skel" style={{ height: 10, width: '60%' }} />
                          <span className="skel" style={{ height: 10, width: '45%' }} />
                        </div>
                        <span className="skel" style={{ width: 92, height: 22, borderRadius: 'var(--r-pill)', flexShrink: 0 }} />
                      </div>
                    ))
                  ) : byDoctor.length === 0 ? (
                    <EmptyState icon="stethoscope" title="No appointment data yet" message="Doctor activity will appear once appointments are booked." />
                  ) : byDoctor.map(d => (
                    <div key={d.id} className="list-item">
                      <DoctorAvatar doctor={{ name: d.full_name, photo: d.photo_url }} size={28} />
                      <div className="list-item-body">
                        <div className="list-item-title">{d.full_name}</div>
                        <div className="list-item-sub">{specialtyOf(d)} · {d.room || '—'}</div>
                      </div>
                      <span className="badge badge-neutral" style={{ flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{d.count}</span>
                        {' '}{d.count === 1 ? 'appointment' : 'appointments'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="h-section">Breakdown by specialty</h2></div>
              <div className="table-wrap">
                <table className="table table-responsive-stack">
                  <thead>
                    <tr>
                      <th>Specialty</th>
                      <th className="col-num">Appointments</th>
                      <th className="col-num">Completed</th>
                      <th className="col-num">Cancelled</th>
                      <th className="col-num">Revenue (completed)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? <SkeletonRows rows={6} cols={5} />
                      : bySpecialty.length === 0 ? (
                      <tr><td colSpan={5} className="empty-cell" style={{ padding: 0 }}>
                        <EmptyState icon="calendar-x" title="No appointment data yet" message="Reports will appear once appointments are booked." />
                      </td></tr>
                    ) : bySpecialty.map(r => (
                      <tr key={r.specialty}>
                        <td data-label="Specialty" style={{ fontWeight: 500 }}>{r.specialty}</td>
                        <td data-label="Appointments" className="col-num">{r.total}</td>
                        <td data-label="Completed" className="col-num">{r.completed}</td>
                        <td data-label="Cancelled" className="col-num">{r.cancelled}</td>
                        <td data-label="Revenue (completed)" className="col-num">₱{r.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="t-muted" style={{ fontSize: 12, marginTop: 12 }}>
              Note: figures are computed live from the system's appointment records.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

export { AdminReports };
