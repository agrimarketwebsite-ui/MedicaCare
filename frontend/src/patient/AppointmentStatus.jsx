// AppointmentStatus — patient (Phase 4: wired to the backend API)
// Optional apptId (galing sa "View status timeline" ng AppointmentDetails o sa
// BookingConfirmation): ipinapakita ang timeline ng TINUKOY na appointment.
// Kung walang apptId (dashboard "Check status"), ang next upcoming appointment
// (pending/confirmed) ang ipinapakita, enriched by the real status_history
// from GET /api/appointments/:id.
import { useEffect, useState } from 'react';
import { AppShell, DoctorAvatar, EmptyState, ErrorState, Icon, navigate, PageHeader, StatusBadge, useStore } from '../shared/components.jsx';
import { getAppointment, getAppointments } from '../shared/api.js';
import { time24Value, toFrontendAppt } from './helpers.js';

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AppointmentStatus({ apptId }) {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [appt, setAppt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    (async () => {
      // Deep link: ipakita ang timeline ng tinukoy na appointment (BOLA-safe —
      // ang GET /api/appointments/:id ay 404 para sa appointment ng iba).
      if (apptId) {
        try {
          const detail = await getAppointment(apptId);
          if (!cancelled) setAppt(toFrontendAppt(detail));
        } catch (err) {
          if (!cancelled) {
            if (err && err.status === 404) setNotFound(true);
            else setLoadError(err.message || 'Hindi ma-load ang appointment.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }
      try {
        const list = await getAppointments();
        const mapped = (list || []).map(toFrontendAppt).filter(Boolean);
        const upcoming = mapped
          .filter(a => a.status === 'pending' || a.status === 'confirmed')
          .sort((a, b) => a.date.localeCompare(b.date) || time24Value(a.time) - time24Value(b.time));
        // Fallback (original page behavior): kapag walang upcoming, ipakita
        // ang PINAKABAGONG appointment kahit cancelled/completed/no-show —
        // ang "No appointments yet" ay para lang sa talagang walang
        // appointment. Kung hindi ito fallback, ang cancelled booking ay
        // magmumukhang walang history.
        const fallback = mapped
          .slice()
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
        const next = upcoming[0] || fallback;
        if (next) {
          // Enrich with the real status history for the timeline
          try {
            const detail = await getAppointment(next.id);
            if (!cancelled) setAppt(toFrontendAppt(detail));
            return;
          } catch {
            // Detail fetch failed — fall back to the list row
          }
        }
        if (!cancelled) setAppt(next);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Hindi ma-load ang appointments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apptId]);

  // Skeleton mirrors the real layout (header card + facts + timeline) so there
  // is no layout shift when the data lands; placed before the !appt early
  // return so the empty state never flashes during the loading window
  if (loading) {
    return (
      <AppShell current="dashboard">
        <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
          <PageHeader
            title="Appointment status"
            subtitle="Track your current appointment's progress."
            breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Status' }]}
            actions={<button className="btn btn-secondary" onClick={() => navigate('/patient/history')}>View history</button>}
          />

          <div className="card" style={{ marginBottom: 16 }} aria-hidden="true">
            <div className="card-body">
              <div className="appt-head">
                <span className="skel" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }} />
                <div className="appt-head-info">
                  <span className="skel" style={{ width: 220, maxWidth: '100%', height: 16, display: 'block' }} />
                  <span className="skel" style={{ width: 260, maxWidth: '100%', height: 12, display: 'block', marginTop: 8 }} />
                </div>
                <div className="appt-head-status">
                  <span className="skel" style={{ width: 80, height: 20, display: 'block' }} />
                  <span className="skel" style={{ width: 110, height: 12, display: 'block', marginTop: 8 }} />
                </div>
              </div>
              <div className="divider" />
              <div className="appt-facts">
                {[0, 1, 2].map(i => (
                  <div key={i} className="appt-fact">
                    <span className="skel" style={{ width: 46, height: 11, display: 'block' }} />
                    <span className="skel" style={{ width: '70%', height: 15, display: 'block', marginTop: 7 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="two-col">
            <div className="card">
              <div className="card-header"><h2 className="h-section">Progress timeline</h2></div>
              <div className="card-body" aria-hidden="true">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                    <span className="skel" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span className="skel" style={{ width: '40%', height: 12, display: 'block' }} />
                      <span className="skel" style={{ width: '65%', height: 10, display: 'block', marginTop: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="h-section">What to bring</h2></div>
              <div className="card-body" aria-hidden="true">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="skel" style={{ width: `${60 + i * 8}%`, height: 12, display: 'block', marginBottom: 12 }} />
                ))}
                <span className="skel" style={{ width: '100%', height: 36, display: 'block', marginTop: 8 }} />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell current="dashboard">
        <div className="page">
          <PageHeader title="Appointment status" breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Status' }]} />
          <div className="card"><ErrorState title="Appointment not found" message="This appointment may have been removed." onRetry={() => navigate('/patient/history')} /></div>
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell current="dashboard">
        <div className="page">
          <PageHeader title="Appointment status" breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Status' }]} />
          <div className="card"><ErrorState title="Hindi ma-load ang status" message={loadError} onRetry={() => window.location.reload()} /></div>
        </div>
      </AppShell>
    );
  }

  if (!appt) {
    return (
      <AppShell current="dashboard">
        <div className="page">
          <PageHeader title="Appointment status" breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Status' }]} />
          <div className="card"><EmptyState icon="calendar-x" title="No appointments yet" message="Book your first appointment to see status updates here."
            actions={<button className="btn btn-primary" onClick={() => navigate('/patient/book')}>Book appointment</button>} /></div>
        </div>
      </AppShell>
    );
  }

  // Doctor display: API fields + directory fallback (avatar/fee/room)
  const dirDoctor = (store.doctors || []).find(d => d.id === appt.doctorId) || window.findDoctor(appt.doctorId);
  const doctor = {
    name: appt.doctorName,
    specialty: appt.specialty,
    room: appt.doctorRoom || dirDoctor?.room || 'MedicaCare',
    fee: appt.doctorFee ?? dirDoctor?.fee ?? 0,
    photo: dirDoctor?.photo,
  };
  // Timeline sub-labels from the real status history when present
  const histAt = (to) => (appt.statusHistory || []).find(h => h.to_status === to)?.created_at;
  const bookedAt = appt.createdAt ? formatDateTime(appt.createdAt) : '';
  const confirmedAt = histAt('confirmed') ? formatDateTime(histAt('confirmed')) : '';
  const completedAt = histAt('completed') ? formatDateTime(histAt('completed')) : '';
  const cancelledAt = histAt('cancelled') ? formatDateTime(histAt('cancelled')) : '';
  const noShowAt = histAt('no-show') ? formatDateTime(histAt('no-show')) : '';
  // Terminal statuses: ang timeline ay nagtatapos sa aktwal na nangyari
  // (hindi sa "Visit completed" na hindi na mangyayari).
  const steps = appt.status === 'cancelled'
    ? [
      { label: 'Booked', sub: `Request submitted${bookedAt ? ` · ${bookedAt}` : ''}`, done: true, active: false },
      { label: 'Cancelled', sub: `This appointment was cancelled${cancelledAt ? ` · ${cancelledAt}` : ''}`, done: true, active: false },
    ]
    : appt.status === 'no-show'
      ? [
        { label: 'Booked', sub: `Request submitted${bookedAt ? ` · ${bookedAt}` : ''}`, done: true, active: false },
        { label: 'Confirmed', sub: `Confirmed${confirmedAt ? ` · ${confirmedAt}` : ''}`, done: true, active: false },
        { label: 'No-show', sub: `Marked as no-show${noShowAt ? ` · ${noShowAt}` : ''}`, done: true, active: false },
      ]
      : [
        { label: 'Booked',    sub: `Request submitted${bookedAt ? ` · ${bookedAt}` : ''}`, done: true, active: false },
        { label: 'Reviewed by staff', sub: appt.status === 'pending' ? 'Awaiting confirmation' : `Confirmed${confirmedAt ? ` · ${confirmedAt}` : ''}`, done: appt.status !== 'pending', active: appt.status === 'pending' },
        { label: 'Confirmed', sub: appt.status === 'confirmed' || appt.status === 'completed' ? 'Ready to visit' : 'Waiting', done: appt.status === 'confirmed' || appt.status === 'completed', active: appt.status === 'confirmed' },
        { label: 'Visit completed', sub: appt.status === 'completed' ? `Completed${completedAt ? ` · ${completedAt}` : ''}` : 'After your visit', done: appt.status === 'completed', active: false },
      ];

  return (
    <AppShell current="dashboard">
      <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
        <PageHeader
          title="Appointment status"
          subtitle="Track your current appointment's progress."
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Status' }]}
          actions={<button className="btn btn-secondary" onClick={() => navigate('/patient/history')}>View history</button>}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="appt-head">
              <DoctorAvatar doctor={doctor} size={56} />
              <div className="appt-head-info">
                <div style={{ fontWeight: 600, fontSize: 16 }}>{doctor.name}</div>
                <div className="t-muted">{doctor.specialty} · {doctor.room}</div>
              </div>
              <div className="appt-head-status">
                <StatusBadge status={appt.status} />
                <div className="t-muted" style={{ fontSize: 13, marginTop: 6 }}>Ref # <span className="t-mono">{appt.reference}</span></div>
              </div>
            </div>
            <div className="divider" />
            <div className="appt-facts">
              <div className="appt-fact">
                <div className="t-help">Date</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{window.formatDateLong(appt.date)}</div>
              </div>
              <div className="appt-fact">
                <div className="t-help">Time</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{appt.timeDisplay}</div>
              </div>
              <div className="appt-fact">
                <div className="t-help">Fee</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>₱{Number(doctor.fee).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-header"><h2 className="h-section">Progress timeline</h2></div>
            <div className="card-body">
              <div className="timeline">
                {steps.map((s, i) => (
                  <div key={i} className="timeline-item">
                    <div className={'timeline-dot ' + (s.done ? 'done' : s.active ? 'active' : '')}>
                      {s.done ? <Icon name="check" size={12} /> : s.active ? <Icon name="clock" size={12} /> : null}
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-title">{s.label}</div>
                      <div className="timeline-sub">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="h-section">What to bring</h2></div>
            <div className="card-body">
              <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
                <li>Valid ID with photo</li>
                <li>HMO card (if applicable)</li>
                <li>List of current medications</li>
                <li>Any prior lab or imaging results</li>
              </ul>
              <div className="divider" />
              <button className="btn btn-secondary block" onClick={() => navigate('/patient/appointment/' + appt.id)}>
                View full appointment details
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export { AppointmentStatus };
