// AppointmentDetails — patient (Phase 4: wired to the backend API)
// GET /api/appointments/:id → details + status_history timeline.
// Reschedule (POST reschedule), cancel (POST cancel), .ics download
// (client-side), at RatingModal para sa completed visits.
import { useEffect, useState } from 'react';
import { AppShell, ConfirmModal, DoctorAvatar, ErrorState, Field, Icon, Modal, navigate, PageHeader, PageSpinner, PatientAvatar, SelectInput, StatusBadge, useStore } from '../shared/components.jsx';
import { cancelAppointment, getAppointment, getSlots, rescheduleAppointment, ApiError } from '../shared/api.js';
import { buildICS, buildReceipt, downloadFile, fmtTime12, isPastSlot, nextDays, time24, time24Value, toFrontendAppt } from './helpers.js';
import { RatingModal } from './RatingModal.jsx';

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function statusLabel(s) {
  return (window.statusMeta(s) || {}).label || s;
}

function AppointmentDetails({ apptId }) {
  const store = useStore();
  const me = store.profile;
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  // Reschedule modal state — hooks stay above the not-found early return
  const [reschedOpen, setReschedOpen] = useState(false);
  const [resDate, setResDate] = useState('');
  const [resDuration, setResDuration] = useState(30);
  const [resSlot, setResSlot] = useState(null);
  const [resSlots, setResSlots] = useState([]);
  const [resSlotsLoading, setResSlotsLoading] = useState(false);
  const [resError, setResError] = useState('');
  const [resLoading, setResLoading] = useState(false);
  // Rate-your-visit modal state (completed appointments only)
  const [rateOpen, setRateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getAppointment(apptId)
      .then((raw) => { if (!cancelled) setAppt(toFrontendAppt(raw)); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Hindi ma-load ang appointment.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apptId]);

  // Reschedule slots — i-fetch kapag bumukas ang modal o nagbago ang date/duration
  useEffect(() => {
    if (!reschedOpen || !appt) return;
    let cancelled = false;
    setResSlotsLoading(true);
    setResError('');
    getSlots(appt.doctorId, resDate, resDuration)
      .then((s) => { if (!cancelled) { setResSlots(s); setResSlotsLoading(false); } })
      .catch((err) => {
        if (!cancelled) {
          setResError(err.message || 'Hindi ma-load ang mga slot.');
          setResSlotsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [reschedOpen, resDate, resDuration, appt]);

  const openReschedule = () => {
    setResDate(appt.date);
    setResDuration(appt.duration || 30);
    setResSlot(appt.time);
    setResError('');
    setReschedOpen(true);
  };

  if (loading) {
    return (
      <AppShell current="history">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

  if (loadError || !appt) {
    return (
      <AppShell current="history">
        <div className="page"><ErrorState title="Appointment not found" message={loadError || 'This appointment may have been removed.'} onRetry={() => navigate('/patient/history')} /></div>
      </AppShell>
    );
  }

  // Doctor display: API doctor fields + store directory (avatar/photo/fee/room)
  const dirDoctor = (store.doctors || []).find(d => d.id === appt.doctorId) || window.findDoctor(appt.doctorId);
  const doctor = {
    name: appt.doctorName,
    specialty: appt.specialty,
    room: appt.doctorRoom || dirDoctor?.room || 'MedicaCare',
    fee: appt.doctorFee ?? dirDoctor?.fee ?? 0,
    photo: dirDoctor?.photo,
  };
  const cancellable = appt.status === 'pending' || appt.status === 'confirmed';
  const myRating = (store.ratings || []).find(r => r.appointmentId === appt.id);
  // Ang API `rated` flag ang source of truth (gumagana cross-device); ang
  // local record ay dagdag lang — ito ang may stars/comment na maipapakita.
  const hasRated = Boolean(appt.rated) || Boolean(myRating);

  const doReschedule = async () => {
    if (!resSlot) return;
    setResLoading(true);
    setResError('');
    try {
      const raw = await rescheduleAppointment(appt.id, {
        appointment_date: resDate,
        start_time: resSlot,
        duration_minutes: resDuration,
      });
      setAppt(toFrontendAppt(raw));
      setReschedOpen(false);
      store.pushToast({ title: 'Appointment rescheduled', msg: `Moved to ${window.formatDate(resDate)} at ${fmtTime12(resSlot + ':00')}.` });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setResError(err.message || 'That slot is no longer available, or this appointment can no longer be rescheduled.');
      } else {
        setResError(err.message || 'Hindi na-reschedule. Pakisubukang muli.');
      }
    } finally {
      setResLoading(false);
    }
  };

  const doCancel = async () => {
    setCancelLoading(true);
    try {
      await cancelAppointment(appt.id);
      store.pushToast({ title: 'Appointment cancelled', msg: 'Your appointment has been cancelled successfully.' });
      navigate('/patient/history');
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Hindi na-cancel', msg: err.message || 'Pakisubukang muli.' });
    } finally {
      setCancelLoading(false);
      setConfirmCancel(false);
    }
  };

  const addToCalendar = () => {
    const durationMin = appt.endTime
      ? Math.max(15, time24Value(appt.endTime) - time24Value(appt.time))
      : (appt.duration || 30);
    downloadFile(
      `medicacare-appointment-${appt.reference || appt.id}.ics`,
      buildICS(
        { id: appt.reference || appt.id, date: appt.date, time: appt.timeDisplay, reason: appt.reason },
        { name: doctor.name, specialty: doctor.specialty, room: doctor.room },
        durationMin,
      ),
      'text/calendar;charset=utf-8',
    );
    store.pushToast({ title: 'Calendar file downloaded', msg: 'Open the .ics file to add this appointment to your calendar.' });
  };

  const downloadReceipt = () => {
    downloadFile(
      `medicacare-receipt-${appt.reference || appt.id}.html`,
      buildReceipt(
        {
          id: appt.reference || appt.id,
          date: appt.date,
          time: appt.timeDisplay,
          reason: appt.reason,
          status: appt.status,
          createdAt: appt.createdAt,
        },
        { name: doctor.name, specialty: doctor.specialty, room: doctor.room, fee: doctor.fee },
        {
          name: me?.full_name || 'Patient',
          dob: me?.date_of_birth,
          bloodType: me?.blood_type,
          allergies: me?.allergies,
          emergencyContact: me?.emergency_contact,
        },
      ),
      'text/html;charset=utf-8',
    );
    store.pushToast({ title: 'Receipt downloaded', msg: 'Open the file to view or print your receipt.' });
  };

  const dates = nextDays(30);
  // Ang past slots ng kasalukuyang araw ay hindi na inaalok sa reschedule
  // picker (ire-reject lang sila ng backend kung pipiliin).
  const visibleResSlots = (resSlots || []).filter(s => !isPastSlot(resDate, s.start_time));
  // Ang sariling kasalukuyang slot ay nananatiling selectable habang
  // nagre-reschedule (ang slots API ay walang exclusion param — ito ay
  // active appointment pa rin kaya "taken" ang lalabas doon)
  const slotState = (s) => {
    const isCurrent = resDate === appt.date && time24(s.start_time) === appt.time;
    return { ...s, selectable: s.is_available || isCurrent, isCurrent };
  };

  return (
    <AppShell current="history">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="Appointment details"
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Appointments', to: '/patient/history' }, { label: 'Details' }]}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => navigate('/patient/history')}><Icon name="arrow-left" size={14} /> Back</button>
              {cancellable && <button className="btn btn-danger" onClick={() => setConfirmCancel(true)}><Icon name="x" size={14} /> Cancel appointment</button>}
            </>
          }
        />

        <div className="two-col">
          <div className="card">
            <div className="card-body">
              <div className="appt-head">
                <DoctorAvatar doctor={doctor} size={56} />
                <div className="appt-head-info">
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{doctor.name}</div>
                  <div className="t-muted">{doctor.specialty}</div>
                </div>
                <div className="appt-head-status">
                  <StatusBadge status={appt.status} />
                </div>
              </div>
              <div className="divider" />
              <div className="detail-list">
                <div className="detail-row"><div className="label">Reference number</div><div className="value t-mono">{appt.reference}</div></div>
                {appt.bookedFor && <div className="detail-row"><div className="label">Booked for</div><div className="value">{appt.bookedFor}</div></div>}
                <div className="detail-row"><div className="label">Date</div><div className="value">{window.formatDateLong(appt.date)}</div></div>
                <div className="detail-row"><div className="label">Time</div><div className="value">{appt.timeDisplay}{appt.endTime ? ` – ${fmtTime12(appt.endTime)}` : ''}</div></div>
                <div className="detail-row"><div className="label">Location</div><div className="value">{doctor.room} · MedicaCare</div></div>
                <div className="detail-row"><div className="label">Consultation fee</div><div className="value">₱{Number(doctor.fee).toLocaleString()}</div></div>
                {appt.createdAt && <div className="detail-row"><div className="label">Booked on</div><div className="value">{window.formatDate(String(appt.createdAt).slice(0, 10))}</div></div>}
                <div className="detail-row"><div className="label">Reason for visit</div><div className="value">{appt.reason}</div></div>
                {appt.contact && <div className="detail-row"><div className="label">Contact number</div><div className="value">{appt.contact}</div></div>}
                {appt.additionalNotes && <div className="detail-row"><div className="label">Additional notes</div><div className="value">{appt.additionalNotes}</div></div>}
                {typeof appt.isFirstVisit === 'boolean' && (
                  <div className="detail-row"><div className="label">Visit type</div><div className="value">{appt.isFirstVisit ? 'First visit' : 'Follow-up'}</div></div>
                )}
              </div>
            </div>
          </div>

          <div className="stack lg">
            <div className="card">
              <div className="card-header"><h3 className="h-card">Patient</h3></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <PatientAvatar person={{ name: me?.full_name, photo: me?.photo_url }} size={44} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{me?.full_name || 'Patient'}</div>
                    <div className="t-muted" style={{ fontSize: 12 }}>{me?.email || ''}</div>
                  </div>
                </div>
                <div className="detail-list">
                  <div className="detail-row compact"><div className="label">Phone</div><div className="value">{me?.phone || '—'}</div></div>
                  <div className="detail-row compact"><div className="label">Blood type</div><div className="value">{me?.blood_type || '—'}</div></div>
                  <div className="detail-row compact"><div className="label">Allergies</div><div className="value">{me?.allergies || 'None'}</div></div>
                </div>
              </div>
            </div>

            {/* Status history — tunay na transitions mula sa backend */}
            <div className="card">
              <div className="card-header"><h3 className="h-card">Status history</h3></div>
              <div className="card-body">
                {(appt.statusHistory || []).length === 0 ? (
                  <p className="t-muted" style={{ fontSize: 13, margin: 0 }}>
                    Currently <strong style={{ color: 'var(--text)' }}>{statusLabel(appt.status)}</strong>. No status changes recorded yet.
                  </p>
                ) : (
                  <div className="timeline">
                    {appt.statusHistory.map((h, i) => (
                      <div key={i} className="timeline-item">
                        <div className="timeline-dot done"><Icon name="check" size={12} /></div>
                        <div className="timeline-body">
                          <div className="timeline-title">{statusLabel(h.from_status)} → {statusLabel(h.to_status)}</div>
                          <div className="timeline-sub">{formatDateTime(h.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {appt.status === 'completed' && (
              <div className="card">
                <div className="card-header"><h3 className="h-card">Your feedback</h3></div>
                <div className="card-body stack md">
                  {hasRated && myRating ? (
                    <>
                      <span className="rating-cell" style={{ fontSize: 14 }}>
                        <Icon name="star" size={16} style={{ color: 'var(--rating-star)' }} />
                        <strong>{myRating.stars}</strong> / 5
                      </span>
                      {myRating.comment && <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{myRating.comment}</p>}
                      {myRating.createdAt && <div className="t-help">Submitted {window.formatDate(String(myRating.createdAt).slice(0, 10))}</div>}
                    </>
                  ) : hasRated ? (
                    <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                      You rated this visit. Thank you!
                    </p>
                  ) : (
                    <>
                      <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                        How was your visit with {doctor.name}? Your rating is shown together with the total number of reviews and is never used to rank doctors.
                      </p>
                      <button className="btn btn-primary block" onClick={() => setRateOpen(true)}><Icon name="star" size={14} /> Rate your visit</button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><h3 className="h-card">Actions</h3></div>
              <div className="card-body stack md">
                <button className="btn btn-secondary block" onClick={downloadReceipt}><Icon name="download" size={14} /> Download receipt</button>
                <button className="btn btn-secondary block" onClick={addToCalendar}><Icon name="calendar" size={14} /> Add to calendar</button>
                <button className="btn btn-secondary block" onClick={() => navigate('/patient/status')}><Icon name="activity" size={14} /> View status timeline</button>
                {cancellable && <button className="btn btn-secondary block" onClick={openReschedule}><Icon name="calendar-clock" size={14} /> Reschedule appointment</button>}
                {cancellable && <button className="btn btn-danger-outline block" onClick={() => setConfirmCancel(true)}><Icon name="x" size={14} /> Cancel appointment</button>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={reschedOpen}
        onClose={() => setReschedOpen(false)}
        title="Reschedule appointment"
        subtitle={`${doctor.name} · currently ${window.formatDate(appt.date)} at ${appt.timeDisplay}`}
        icon="calendar-clock"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setReschedOpen(false)} disabled={resLoading}>Close</button>
            <button
              className={`btn btn-primary ${resLoading ? 'btn-loading' : ''}`}
              disabled={!resSlot || (resDate === appt.date && resSlot === appt.time) || resLoading}
              onClick={doReschedule}
            >
              Save new schedule
            </button>
          </>
        }
      >
        <div className="stack md">
          {resError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
              {resError}
            </div>
          )}
          <Field label="New date" required>
            <SelectInput value={resDate} onChange={e => { setResDate(e.target.value); setResSlot(null); }}>
              {dates.map(d => (
                <option key={d} value={d}>{window.formatDateLong(d)}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Duration">
            <div className="chip-group" style={{ margin: 0 }}>
              {[30, 60].map(m => (
                <button key={m} type="button" className={'chip' + (resDuration === m ? ' on' : '')}
                  aria-pressed={resDuration === m}
                  onClick={() => { setResDuration(m); setResSlot(null); }}>
                  {m} min
                </button>
              ))}
            </div>
          </Field>
          <Field label="Available time slots" required help="Slots already booked are disabled.">
            {resSlotsLoading ? (
              <div className="chip-group" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i} className="skel" style={{ width: 84, height: 34, borderRadius: 8 }} />
                ))}
              </div>
            ) : (
              <div className="chip-group">
                {visibleResSlots.map(s => {
                  const st = slotState(s);
                  return (
                    <button key={s.start_time} type="button"
                      className={'chip' + (resSlot === time24(s.start_time) ? ' on' : '')}
                      disabled={!st.selectable}
                      title={st.isCurrent ? 'Your current slot' : fmtTime12(s.start_time) + ' – ' + fmtTime12(s.end_time)}
                      onClick={() => setResSlot(time24(s.start_time))}>
                      {fmtTime12(s.start_time)}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        </div>
      </Modal>

      <RatingModal open={rateOpen} appointment={appt} onClose={() => setRateOpen(false)} />

      <ConfirmModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={doCancel}
        loading={cancelLoading}
        title="Cancel this appointment?"
        message={`${doctor.name} on ${window.formatDate(appt.date)} at ${appt.timeDisplay}. This action cannot be undone.`}
        confirmLabel="Yes, cancel it"
        kind="danger"
      />
    </AppShell>
  );
}

export { AppointmentDetails };
