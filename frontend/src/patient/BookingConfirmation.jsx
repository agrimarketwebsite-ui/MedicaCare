// BookingConfirmation — patient (Phase 4: wired to the backend API)
// Lands here from BookAppointment as /patient/confirmation?ref=AP-000123.
// The appointment is re-fetched from GET /api/appointments so the page also
// works as a deep link — never a false success from stale store state.
import { useEffect, useState } from 'react';
import { AppShell, DoctorAvatar, EmptyState, Icon, navigate, StatusBadge, useHashRoute } from '../shared/components.jsx';
import { getAppointments } from '../shared/api.js';
import { toFrontendAppt } from './helpers.js';

function BookingConfirmation() {
  const route = useHashRoute();
  const [, query] = route.split('?');
  const ref = new URLSearchParams(query || '').get('ref');
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!ref) { setLoading(false); return; }
    getAppointments()
      .then((list) => {
        if (cancelled) return;
        const found = (list || []).find(a => a.reference_code === ref);
        setAppt(toFrontendAppt(found));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const doctor = appt ? { name: appt.doctorName, specialty: appt.specialty } : null;

  return (
    <AppShell current="doctors">
      <div className="page" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        {/* §15/§32: deep-linking here without a reference (o hindi mahanap ang
            booking) must not read as a false success */}
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }} aria-hidden="true">
            <span className="skel" style={{ width: 72, height: 72, borderRadius: '50%', display: 'inline-block', marginBottom: 20 }} />
            <span className="skel" style={{ width: '60%', height: 20, display: 'block', margin: '0 auto 8px' }} />
            <span className="skel" style={{ width: '80%', height: 14, display: 'block', margin: '0 auto' }} />
          </div>
        ) : !appt ? (
          <div className="card">
            <EmptyState
              icon="calendar-x"
              title="No booking to show"
              message="We couldn't find that booking. Book an appointment first, or open it later from your appointment history."
              actions={<button className="btn btn-primary" onClick={() => navigate('/patient/book')}>Book an appointment</button>}
            />
          </div>
        ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Icon name="check-circle-2" size={36} />
          </div>
          <h1 className="h-page" style={{ marginBottom: 8 }}>Appointment successfully booked</h1>
          <p className="t-muted" style={{ fontSize: 14, maxWidth: 400, margin: '0 auto 8px' }}>
            {appt.status === 'confirmed'
              ? 'Your appointment is confirmed — no waiting for staff review. You can track it any time from your dashboard.'
              : 'Your appointment request has been received. You can track your appointment status any time from your dashboard.'}
          </p>
          {/* Reference code — prominently, tulad ng hinihingi ng pasyente sa resibo */}
          <div className="t-mono" style={{
            display: 'inline-block', fontSize: 22, fontWeight: 700, letterSpacing: '0.04em',
            color: 'var(--primary)', background: 'var(--primary-soft)',
            border: '1px dashed var(--primary-border)', borderRadius: 10,
            padding: '10px 22px', margin: '12px 0 24px',
          }}>
            {appt.reference}
          </div>

          {doctor && (
            <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, textAlign: 'left', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <DoctorAvatar doctor={doctor} size={44} />
                <div>
                  <div style={{ fontWeight: 600 }}>{doctor.name}</div>
                  <div className="t-muted" style={{ fontSize: 13 }}>{doctor.specialty}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}><StatusBadge status={appt.status} /></div>
              </div>
              <div className="divider" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div className="t-help">Date</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{window.formatDate(appt.date)}</div>
                </div>
                <div>
                  <div className="t-help">Time</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{appt.timeDisplay}</div>
                </div>
                <div>
                  <div className="t-help">Location</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{appt.doctorRoom || 'MedicaCare'}</div>
                </div>
                <div>
                  <div className="t-help">Reference #</div>
                  <div className="t-mono" style={{ fontSize: 14, fontWeight: 500 }}>{appt.reference}</div>
                </div>
                {/* Proxy booking: confirm immediately who the visit is for */}
                {appt.bookedFor && (
                  <div>
                    <div className="t-help">Booking for</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{appt.bookedFor}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/patient/dashboard')}>Back to dashboard</button>
            <button className="btn btn-secondary" onClick={() => navigate('/patient/appointment/' + appt.id)}>View details</button>
            <button className="btn btn-primary" onClick={() => navigate('/patient/status')}>View appointment status</button>
          </div>
        </div>
        )}
      </div>
    </AppShell>
  );
}

export { BookingConfirmation };
