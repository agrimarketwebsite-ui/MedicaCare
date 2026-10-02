// BookAppointment — patient (Phase 4: wired to the backend API)
// Slot comes from DoctorAvailability via store.pendingBooking
// ({ doctorId, date, time "HH:MM", duration }). POST /api/appointments →
// 201 navigates to the confirmation with the reference_code; 409 (slot taken)
// shows a friendly message with a back-to-slots action.
import { useEffect, useState } from 'react';
import { AppShell, DoctorAvatar, EmptyState, Field, Icon, navigate, PageHeader, PageSpinner, SelectInput, TextArea, TextInput, useStore } from '../shared/components.jsx';
import { bookAppointment, ApiError } from '../shared/api.js';
import { fmtTime12, focusFirstError } from './helpers.js';

function BookAppointment() {
  const store = useStore();
  const pending = store.pendingBooking;
  const me = store.profile;
  const doctorsReady = (store.doctors || []).length > 0;
  const doctor = pending ? ((store.doctors || []).find(d => d.id === pending.doctorId) || window.findDoctor(pending.doctorId)) : null;
  // Race guard: hintayin ang doctor directory hydration bago mag-empty state
  const [dirWaited, setDirWaited] = useState(false);
  useEffect(() => {
    if (doctorsReady) return;
    const t = setTimeout(() => setDirWaited(true), 2500);
    return () => clearTimeout(t);
  }, [doctorsReady]);

  const [form, setForm] = useState({
    reason: '',
    notes: '',
    contact: me?.phone || '',
    isFirstVisit: 'yes',
    forWhom: 'self',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(''); // 409 / network / validation mula sa server
  const [slotTaken, setSlotTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  // Ang profile ay async na hina-hydrate — i-prefill ang contact kapag dumating
  // (huwag i-overwrite kapag may tinayp na ang user)
  useEffect(() => {
    if (me?.phone) setForm(f => (f.contact ? f : { ...f, contact: me.phone }));
  }, [me?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };

  if (!doctorsReady && !dirWaited && pending) {
    return (
      <AppShell current="book">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

  if (!pending || !doctor) {
    return (
      <AppShell current="book">
        <div className="page">
          <PageHeader
            title="Book an appointment"
            breadcrumbs={[
              { label: 'Home', to: '/patient/dashboard' },
              { label: 'Find a doctor', to: '/patient/doctors' },
              { label: 'Book appointment' },
            ]}
          />
          <div className="card">
            <EmptyState
              icon="calendar-search"
              title="No time slot selected"
              message="Pick a doctor and choose an available time slot first — then you'll land back here to finish booking."
              actions={<button className="btn btn-primary" onClick={() => navigate('/patient/doctors')}><Icon name="stethoscope" size={14} /> Find a doctor</button>}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  const submit = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!form.reason.trim()) e.reason = 'Please tell us the reason for your visit';
    else if (form.reason.trim().length < 10) e.reason = 'Please provide a bit more detail (10+ characters)';
    if (!form.contact.trim()) e.contact = 'Contact number is required';
    setErrors(e);
    setSubmitError('');
    setSlotTaken(false);
    if (Object.keys(e).length) { focusFirstError(); return; }

    setLoading(true);
    try {
      const appt = await bookAppointment({
        doctor_id: pending.doctorId,
        appointment_date: pending.date,
        start_time: pending.time, // "HH:MM"
        duration_minutes: pending.duration || 30,
        reason: form.reason.trim(),
        ...(form.notes.trim() ? { additional_notes: form.notes.trim() } : {}),
        contact_number: form.contact.trim(),
        is_first_visit: form.isFirstVisit === 'yes',
        ...(form.forWhom !== 'self' ? { family_member_id: form.forWhom } : {}),
      });
      store.setPendingBooking(null);
      store.pushToast({ title: 'Appointment booked', msg: `Reference ${appt.reference_code} — see you on ${pending.date}.` });
      navigate('/patient/confirmation?ref=' + encodeURIComponent(appt.reference_code));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Slot taken (o invalid sa server) — huwag iwan ang user sa ere:
        // malinaw na mensahe + balik sa slots
        setSlotTaken(true);
        setSubmitError(err.message || 'That slot has just been taken. Please pick a different date or time.');
      } else {
        setSubmitError(err.message || 'Hindi na-book ang appointment. Pakisubukang muli.');
      }
      window.scrollTo(0, 0);
    } finally {
      setLoading(false);
    }
  };

  const forWhomName = form.forWhom === 'self'
    ? (me?.full_name || 'Myself')
    : ((store.familyMembers || []).find(f => f.id === form.forWhom)?.full_name || '');

  return (
    <AppShell current="book">
      <div className="page">
        <PageHeader
          title="Book an appointment"
          subtitle="Review the details below and confirm your appointment."
          breadcrumbs={[
            { label: 'Home', to: '/patient/dashboard' },
            { label: 'Find a doctor', to: '/patient/doctors' },
            { label: 'Book appointment' },
          ]}
        />

        {submitError && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--error-border)', background: 'var(--error-soft)' }}>
            <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="alert-triangle" size={18} style={{ color: 'var(--error)', marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--error-text)', marginBottom: 4 }}>
                  {slotTaken ? 'That slot was just taken' : 'Booking failed'}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{submitError}</div>
                {slotTaken && (
                  <button className="btn btn-secondary sm" style={{ marginTop: 10 }}
                    onClick={() => navigate('/patient/availability/' + pending.doctorId)}>
                    <Icon name="arrow-left" size={13} /> Back to available slots
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="two-col">
          <form onSubmit={submit} noValidate>
            <div className="card">
              <div className="card-header"><h2 className="h-section">Appointment details</h2></div>
              <div className="card-body">
                <div className="stack lg">
                  <Field label="Who is this visit for?" help="Book for yourself or a family member saved on your Profile page.">
                    <SelectInput value={form.forWhom} onChange={e => update('forWhom', e.target.value)}>
                      <option value="self">Myself{me?.full_name ? ` (${me.full_name})` : ''}</option>
                      {(store.familyMembers || []).map(f => (
                        <option key={f.id} value={f.id}>{f.full_name} ({f.relation})</option>
                      ))}
                    </SelectInput>
                  </Field>

                  <Field label="Reason for visit" required error={errors.reason}
                    help={!errors.reason && "Briefly describe your symptoms or reason. This helps the doctor prepare."}>
                    <TextArea
                      placeholder="e.g., Follow-up on blood pressure medication and ECG review"
                      value={form.reason}
                      onChange={e => update('reason', e.target.value)}
                      error={errors.reason}
                      maxLength={500}
                    />
                    <div className="t-help" style={{ textAlign: 'right', marginTop: -4 }}>{form.reason.length}/500</div>
                  </Field>

                  <Field label="Additional notes" help="Optional. Anything else the doctor should know.">
                    <TextArea placeholder="Any allergies, current medications, recent test results…"
                      value={form.notes} onChange={e => update('notes', e.target.value)} />
                  </Field>

                  <Field label="Contact number" required error={errors.contact}>
                    <TextInput icon="phone" type="tel" value={form.contact}
                      onChange={e => update('contact', e.target.value)} error={errors.contact} />
                  </Field>

                  <Field label="Is this your first visit with this doctor?">
                    <div style={{ display: 'flex', gap: 16 }}>
                      <label className="radio"><input type="radio" name="fv" checked={form.isFirstVisit === 'yes'} onChange={() => update('isFirstVisit', 'yes')} /> Yes, first visit</label>
                      <label className="radio"><input type="radio" name="fv" checked={form.isFirstVisit === 'no'} onChange={() => update('isFirstVisit', 'no')} /> Follow-up</label>
                    </div>
                  </Field>
                </div>
              </div>
              <div className="card-footer">
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/patient/availability/' + pending.doctorId)}>Back to slots</button>
                <button type="submit" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
                  Confirm booking
                </button>
              </div>
            </div>
          </form>

          <div className="stack lg">
            <div className="card">
              <div className="card-header"><h2 className="h-section">Summary</h2></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <DoctorAvatar doctor={doctor} size={44} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{doctor.name}</div>
                    <div className="t-muted" style={{ fontSize: 13 }}>{doctor.specialty}</div>
                  </div>
                </div>
                <div className="detail-list">
                  {/* Compact stacked rows: this card sits in the narrow 1fr
                      side column — the side-by-side label/value grid leaves
                      too little room for values like long dates (same
                      pattern as the other narrow side cards) */}
                  <div className="detail-row compact"><div className="label">Visit for</div><div className="value">{forWhomName}</div></div>
                  <div className="detail-row compact"><div className="label">Date</div><div className="value">{window.formatDateLong(pending.date)}</div></div>
                  <div className="detail-row compact"><div className="label">Time</div><div className="value">{fmtTime12(pending.time + ':00')} ({pending.duration || 30} min)</div></div>
                  <div className="detail-row compact"><div className="label">Location</div><div className="value">{doctor.room}</div></div>
                  <div className="detail-row compact"><div className="label">Consultation fee</div><div className="value">₱{Number(doctor.fee || 0).toLocaleString()}</div></div>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--info-soft)', borderColor: 'var(--info-border)' }}>
              <div style={{ padding: 16, display: 'flex', gap: 12 }}>
                <Icon name="info" size={18} style={{ color: 'var(--info)', marginTop: 2 }} />
                <div style={{ fontSize: 13, color: 'var(--info-text)', lineHeight: 1.6 }}>
                  {(store.prefs || {}).autoConfirm
                    ? 'Your appointment is confirmed instantly — no waiting for staff review. You can cancel free of charge any time before your visit.'
                    : 'Your appointment will be reviewed by our staff. Its status will update here in the portal. You can cancel free of charge any time before your visit.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export { BookAppointment };
