// BookAppointment — patient (Phase 4: wired to the backend API)
// Buong booking form sa iisang page: doctor / date / time slot ay pinipili
// dito mismo (ang time slots ay galing sa GET /api/appointments/slots).
// Kapag galing sa DoctorAvailability, ang store.pendingBooking ay
// nagpi-pre-fill ng doctor/date/time — editable pa rin ang lahat ng fields.
// POST /api/appointments → 201 navigates to the confirmation with the
// reference_code; 409 (slot taken / attendee overlap) shows an error banner.
import { useEffect, useState } from 'react';
import { AppShell, DoctorAvatar, Field, Icon, navigate, PageHeader, PageSpinner, SelectInput, TextArea, TextInput, useStore } from '../shared/components.jsx';
import { bookAppointment, getSlots, ApiError } from '../shared/api.js';
import { fmtTime12, focusFirstError, isPastSlot, nextDays, time24 } from './helpers.js';

import { Profile } from './Profile.jsx';

// ---------- Book Appointment (form) ----------
function BookAppointment() {
  const store = useStore();
  const pending = store.pendingBooking;
  const me = store.profile;
  // Simulated fetch — centered circle spinner while "loading", same 600ms
  // pattern as the other patient pages
  const [pageLoading, setPageLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPageLoading(false), 600); return () => clearTimeout(t); }, []);
  // Walang visible duration control — ang tagal ay galing sa draft
  // (DoctorAvailability) o default na 30 minuto; ipinapasa lang sa API
  const [duration] = useState(pending?.duration || 30);
  const [form, setForm] = useState({
    doctorId: pending?.doctorId || '',
    date: pending?.date || '',
    time: pending?.time || '',
    reason: '',
    notes: '',
    contact: me?.phone || '',
    isFirstVisit: 'yes',
    forWhom: 'self',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(''); // 409 / network / validation mula sa server
  const [slotTaken, setSlotTaken] = useState(false);
  const [overlapError, setOverlapError] = useState(false); // 409: may appointment na ang attendee sa oras na ito
  const [loading, setLoading] = useState(false);
  // Time slots ng napiling doctor+date (GET /api/appointments/slots)
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  // Ang profile ay async na hina-hydrate — i-prefill ang contact kapag dumating
  // (huwag i-overwrite kapag may tinayp na ang user)
  useEffect(() => {
    if (me?.phone) setForm(f => (f.contact ? f : { ...f, contact: me.phone }));
  }, [me?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  // I-fetch ang slots tuwing magbago ang doctor/date/duration; ang cleanup
  // flag ang guard laban sa stale responses (mas lumang request na huling dumating)
  useEffect(() => {
    if (!form.doctorId || !form.date) { setSlots([]); setSlotsLoading(false); return; }
    let cancelled = false;
    setSlotsLoading(true);
    getSlots(form.doctorId, form.date, duration)
      .then((s) => { if (!cancelled) { setSlots(s); setSlotsLoading(false); } })
      .catch(() => { if (!cancelled) { setSlots([]); setSlotsLoading(false); } });
    return () => { cancelled = true; };
  }, [form.doctorId, form.date, duration]);

  const doctor = form.doctorId
    ? ((store.doctors || []).find(d => d.id === form.doctorId) || window.findDoctor(form.doctorId))
    : null;
  // Ang past slots ng kasalukuyang araw ay hindi inaalok sa dropdown
  // (ire-reject lang sila ng backend kung pipiliin — nakakalito).
  const availableSlots = slots.filter(s => s.is_available && !isPastSlot(form.date, s.start_time));

  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };
  // Switching doctors invalidates the previously chosen date + slot
  const changeDoctor = (v) => {
    if (v === form.doctorId) return;
    setForm(f => ({ ...f, doctorId: v, date: '', time: '' }));
    setErrors(e => ({ ...e, doctorId: null, date: null, time: null }));
  };
  // Changing dates invalidates the previously chosen time slot
  const changeDate = (v) => {
    if (v === form.date) return;
    setForm(f => ({ ...f, date: v, time: '' }));
    setErrors(e => ({ ...e, date: null, time: null }));
  };

  const submit = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!form.doctorId) e.doctorId = 'Please select a doctor';
    if (!form.date) e.date = 'Please pick a date';
    if (!form.time) e.time = 'Please pick a time slot';
    if (!form.reason.trim()) e.reason = 'Please tell us the reason for your visit';
    else if (form.reason.trim().length < 10) e.reason = 'Please provide a bit more detail (10+ characters)';
    if (!form.contact.trim()) e.contact = 'Contact number is required';
    setErrors(e);
    setSubmitError('');
    setSlotTaken(false);
    setOverlapError(false);
    if (Object.keys(e).length) { focusFirstError(); return; }

    setLoading(true);
    try {
      const appt = await bookAppointment({
        doctor_id: form.doctorId,
        appointment_date: form.date,
        start_time: form.time, // "HH:MM"
        duration_minutes: duration,
        reason: form.reason.trim(),
        ...(form.notes.trim() ? { additional_notes: form.notes.trim() } : {}),
        contact_number: form.contact.trim(),
        is_first_visit: form.isFirstVisit === 'yes',
        ...(form.forWhom !== 'self' ? { family_member_id: form.forWhom } : {}),
      });
      store.setPendingBooking(null);
      navigate('/patient/confirmation?ref=' + encodeURIComponent(appt.reference_code));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Dalawang klase ng 409: (a) ang slot mismo ay nakuha na / hindi na
        // available, (b) ang attendee ay may appointment na sa oras na iyon
        // (overlap). I-fit ang banner title sa totoong dahilan.
        const msg = err.message || '';
        if (/already have an appointment/i.test(msg)) {
          setOverlapError(true);
          setSubmitError(msg);
        } else if (/slot/i.test(msg) && /(not available|no longer available|taken|unavailable)/i.test(msg)) {
          setSlotTaken(true);
          setSubmitError(msg);
        } else {
          setSubmitError(msg || 'That slot has just been taken. Please pick a different date or time.');
        }
      } else {
        setSubmitError(err.message || 'Could not book the appointment. Please try again.');
      }
      window.scrollTo(0, 0);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <AppShell current="book">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

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
                  {slotTaken ? 'That slot was just taken' : overlapError ? submitError : 'Booking failed'}
                </div>
                {!overlapError && (
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{submitError}</div>
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
                  <Field label="Doctor" required error={errors.doctorId}>
                    <SelectInput value={form.doctorId} onChange={e => changeDoctor(e.target.value)} error={errors.doctorId}>
                      <option value="">Select a doctor…</option>
                      {/* On-leave doctors are hidden here too so the dropdown
                          can't bypass the availability page's on-leave guard */}
                      {(store.doctors || []).filter(d => d.status !== 'on-leave').map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Who is this visit for?" help="Book for yourself or a family member saved on your Profile page.">
                    <SelectInput value={form.forWhom} onChange={e => update('forWhom', e.target.value)}>
                      <option value="self">Myself{me?.full_name ? ` (${me.full_name})` : ''}</option>
                      {(store.familyMembers || []).map(f => (
                        <option key={f.id} value={f.id}>{f.full_name} ({f.relation})</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Date" required error={errors.date}>
                      <SelectInput value={form.date} onChange={e => changeDate(e.target.value)} error={errors.date}>
                        <option value="">Choose a date…</option>
                        {nextDays(30).map(d => (
                          <option key={d} value={d}>{window.formatDateLong(d)}</option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Time slot" required error={errors.time}>
                      <SelectInput value={form.time} onChange={e => update('time', e.target.value)} error={errors.time}>
                        {(!form.doctorId || !form.date) ? (
                          <option value="">Choose a doctor and date first…</option>
                        ) : slotsLoading ? (
                          <option value="">Loading slots…</option>
                        ) : availableSlots.length === 0 ? (
                          <option value="">No slots available on this date</option>
                        ) : (
                          <>
                            <option value="">Choose a time…</option>
                            {availableSlots.map(s => (
                              <option key={s.start_time} value={time24(s.start_time)}>{fmtTime12(s.start_time)}</option>
                            ))}
                          </>
                        )}
                      </SelectInput>
                    </Field>
                  </div>

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
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/patient/doctors')}>Cancel</button>
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
                {doctor ? (
                  <>
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
                      <div className="detail-row compact"><div className="label">Date</div><div className="value">{form.date ? window.formatDateLong(form.date) : '—'}</div></div>
                      <div className="detail-row compact"><div className="label">Time</div><div className="value">{form.time ? fmtTime12(form.time + ':00') : '—'}</div></div>
                      <div className="detail-row compact"><div className="label">Location</div><div className="value">{doctor.room}</div></div>
                      <div className="detail-row compact"><div className="label">Consultation fee</div><div className="value">₱{Number(doctor.fee || 0).toLocaleString()}</div></div>
                    </div>
                  </>
                ) : (
                  <div className="t-muted" style={{ padding: '12px 0' }}>Select a doctor to see summary.</div>
                )}
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
