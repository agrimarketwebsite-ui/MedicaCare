// DoctorAvailability — patient (Phase 4: wired to the backend API)
// Date picker (next 30 days) + duration selector (30/60) →
// GET /api/appointments/slots. Selected slot → BookAppointment via
// store.pendingBooking.
import { useEffect, useState } from 'react';
import { AppShell, DoctorAvatar, DoctorRatingPill, DoctorStatusBadge, EmptyState, ErrorState, Icon, navigate, PageHeader, PageSpinner, useStore } from '../shared/components.jsx';
import { getSlots } from '../shared/api.js';
import { fmtTime12, isPastSlot, nextDays, time24 } from './helpers.js';

const DURATIONS = [30, 60];

function DoctorAvailability({ doctorId }) {
  const store = useStore();
  const doctorsReady = (store.doctors || []).length > 0;
  const doctor = (store.doctors || []).find(d => d.id === doctorId) || window.findDoctor(doctorId);
  // Race guard: sa fresh deep link, ang doctor directory ay hina-hydrate pa
  // (public hydration) — maghintay muna bago mag-"Doctor not found"
  const [dirWaited, setDirWaited] = useState(false);
  useEffect(() => {
    if (doctorsReady) return;
    const t = setTimeout(() => setDirWaited(true), 2500);
    return () => clearTimeout(t);
  }, [doctorsReady]);
  const dates = nextDays(30);
  const [date, setDate] = useState(dates[0]);
  const [duration, setDuration] = useState(() => {
    const pref = Number((store.prefs || {}).slotInterval);
    return DURATIONS.includes(pref) ? pref : 30;
  });
  const [slot, setSlot] = useState(null); // selected start_time "HH:MM:SS"
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!doctor) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError('');
    setSlot(null);
    getSlots(doctorId, date, duration)
      .then((s) => { if (!cancelled) { setSlots(s); setSlotsLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setSlotsError(err.message || 'Hindi ma-load ang mga slot. Pakisubukang muli.');
          setSlotsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [doctorId, date, duration, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doctorsReady && !dirWaited) {
    return (
      <AppShell current="doctors">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

  if (!doctor) {
    return (
      <AppShell current="doctors">
        <div className="page"><ErrorState title="Doctor not found" message="This doctor may have moved or been removed." onRetry={() => navigate('/patient/doctors')} /></div>
      </AppShell>
    );
  }

  // On-leave doctors are not bookable — the list pages disable the Book
  // button; this guards the same flow against a typed deep link
  if (doctor.status === 'on-leave') {
    return (
      <AppShell current="doctors">
        <div className="page">
          <ErrorState
            title="This doctor is on leave"
            message={`${doctor.name} is not accepting bookings right now. Browse other specialists and check back when they return.`}
            onRetry={() => navigate('/patient/doctors')}
          />
        </div>
      </AppShell>
    );
  }

  // Ang past slots ng kasalukuyang araw ay hindi na dini-display (nakakalito
  // kung naka-display pa pero ire-reject lang sa booking) — ang "Booked"
  // slots ay nananatiling naka-display bilang disabled.
  const visibleSlots = slots.filter(s => !isPastSlot(date, s.start_time));
  const available = visibleSlots.filter(s => s.is_available);
  const selectedSlot = visibleSlots.find(s => s.start_time === slot);

  const cont = () => {
    if (!selectedSlot) return;
    store.setPendingBooking({ doctorId: doctor.id, date, time: time24(selectedSlot.start_time), duration });
    navigate('/patient/book');
  };

  return (
    <AppShell current="doctors">
      <div className="page">
        <PageHeader
          title={doctor.name}
          subtitle={`${doctor.specialty} · ${doctor.room}`}
          breadcrumbs={[
            { label: 'Home', to: '/patient/dashboard' },
            { label: 'Find a doctor', to: '/patient/doctors' },
            { label: 'Availability' },
          ]}
          actions={<button className="btn btn-ghost" onClick={() => navigate('/patient/doctors')}><Icon name="arrow-left" size={14} /> Back</button>}
        />

        <div className="two-col">
          <div className="stack lg">
            <div className="card">
              <div className="card-header">
                <h2 className="h-section">Select a date</h2>
                <span className="t-muted" style={{ fontSize: 12 }}>Available in the coming 30 days</span>
              </div>
              <div className="date-chip-row">
                {dates.map(d => {
                  const dt = new Date(d + 'T00:00:00');
                  const on = d === date;
                  return (
                    <button key={d}
                      aria-pressed={on}
                      onClick={() => setDate(d)}
                      className="chip date-chip"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '10px 14px', borderRadius: 8,
                        background: on ? 'var(--primary)' : 'var(--surface)',
                        color: on ? '#fff' : 'var(--text-secondary)',
                        borderColor: on ? 'var(--primary)' : 'var(--border-strong)',
                      }}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                        {dt.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{dt.getDate()}</span>
                      <span style={{ fontSize: 10, fontWeight: 500 }}>{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="h-section">Available time slots</h2>
                <span className="t-muted" style={{ fontSize: 12 }}>{window.formatDateLong(date)}</span>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span className="t-help" style={{ fontWeight: 600 }}>Duration:</span>
                  <div className="chip-group" style={{ margin: 0 }}>
                    {DURATIONS.map(m => (
                      <button key={m} type="button" className={'chip' + (duration === m ? ' on' : '')}
                        aria-pressed={duration === m}
                        onClick={() => setDuration(m)}>
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>

                {slotsLoading ? (
                  <div className="chip-group" aria-hidden="true">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} className="skel" style={{ width: 84, height: 34, borderRadius: 8 }} />
                    ))}
                  </div>
                ) : slotsError ? (
                  <ErrorState title="Hindi ma-load ang mga slot" message={slotsError}
                    onRetry={() => setRetryKey(k => k + 1)} />
                ) : visibleSlots.length === 0 ? (
                  <EmptyState icon="calendar-x" title="No slots on this date"
                    message="The doctor has no clinic hours on this date. Please pick another date." />
                ) : (
                  <>
                    <div className="chip-group">
                      {visibleSlots.map(s => (
                        <button key={s.start_time} className={'chip' + (slot === s.start_time ? ' on' : '')}
                          aria-pressed={slot === s.start_time}
                          disabled={!s.is_available}
                          title={s.is_available ? `${fmtTime12(s.start_time)} – ${fmtTime12(s.end_time)}` : 'Booked'}
                          onClick={() => setSlot(s.start_time)}>
                          {fmtTime12(s.start_time)}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)' }} /> Available</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 999, background: 'var(--surface-muted)' }} /> Booked</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 999, background: 'var(--primary)' }} /> Selected</div>
                    </div>
                    {available.length === 0 && (
                      <p className="t-muted" style={{ fontSize: 13, marginTop: 12 }}>
                        All slots on this date are booked. Please pick another date.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="card-footer">
                <button className="btn btn-secondary" onClick={() => navigate('/patient/doctors')}>Cancel</button>
                <button className="btn btn-primary" disabled={!selectedSlot} onClick={cont}>
                  Continue
                </button>
              </div>
            </div>
          </div>

          <div className="stack lg">
            <div className="card">
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <DoctorAvatar doctor={doctor} size={56} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{doctor.name}</div>
                    <div className="t-muted">{doctor.specialty}</div>
                  </div>
                </div>
                <DoctorStatusBadge status={doctor.status} />
                <div className="divider" />
                {/* Stacked label/value rows (detail-row compact): this card sits in
                    the narrow 1fr side column — the fixed 180px label column of the
                    default detail-row leaves too little room for values like
                    "Outpatient • Rm 120" or the rating pill, so they wrapped onto a
                    second line. Compact gives each value the full card width on one
                    line (same pattern as the Book Appointment summary card). */}
                <div className="detail-list">
                  <div className="detail-row compact"><div className="label">Consultation fee</div><div className="value">₱{Number(doctor.fee || 0).toLocaleString()}</div></div>
                  <div className="detail-row compact"><div className="label">Experience</div><div className="value">{doctor.exp} years</div></div>
                  <div className="detail-row compact"><div className="label">Rating</div><div className="value"><DoctorRatingPill avg={doctor.rating} count={doctor.ratingCount} /></div></div>
                  <div className="detail-row compact"><div className="label">Room</div><div className="value">{doctor.room}</div></div>
                  <div className="detail-row compact"><div className="label">Consultation length</div><div className="value">{duration} minutes</div></div>
                </div>
              </div>
            </div>

            {/* Honesty label: portraits are placeholders; ratings are real
                patient feedback (v_doctor_rating_averages) */}
            <p className="t-muted" style={{ fontSize: 12.5 }}>
              Photos are sample placeholder portraits, not real staff portraits. Ratings are averages of real patient feedback from completed visits.
            </p>

            {selectedSlot && (
              <div className="card" style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}>
                <div style={{ padding: 16 }}>
                  <div className="t-help" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>Your selection</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}><Icon name="calendar" size={14} /> {window.formatDateLong(date)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}><Icon name="clock" size={14} /> {fmtTime12(selectedSlot.start_time)} – {fmtTime12(selectedSlot.end_time)} ({duration} min)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export { DoctorAvailability };
