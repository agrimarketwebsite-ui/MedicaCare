// CompleteVisitModal — doctor portal
// The doctor writes their own notes. Completing the visit sets the
// appointment to completed and creates a consultation record the patient
// can see in their portal.
import { useEffect, useState } from 'react';
import { Field, Modal, TextArea, useStore } from '../shared/components.jsx';
import { api, completeVisit, ApiError } from '../shared/api.js';
import { fmtTime12, focusFirstError } from './helpers.js';

function CompleteVisitModal({ appointment, onClose, onCompleted }) {
  const store = useStore();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [priorVisits, setPriorVisits] = useState(null);

  useEffect(() => {
    if (appointment) {
      setNotes('');
      setError('');
      setSaving(false);
      setPriorVisits(null);
      // Clinical context — completed visits this patient already had with
      // this doctor (first-time vs returning)
      const pid = appointment.patient?.id;
      if (pid) {
        let cancelled = false;
        api(`/doctor/appointments?patient_id=${encodeURIComponent(pid)}&status=completed`)
          .then((d) => {
            if (cancelled) return;
            const list = d.appointments || [];
            setPriorVisits(list.filter(a => a.id !== appointment.id).length);
          })
          .catch(() => { if (!cancelled) setPriorVisits(0); });
        return () => { cancelled = true; };
      }
    }
  }, [appointment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!appointment) return null;
  const patientName = appointment.patient?.full_name || appointment.booked_for || 'Patient';

  const save = async () => {
    const n = notes.trim();
    if (n.length < 10) {
      setError('Please write the visit summary (10+ characters).');
      focusFirstError();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await completeVisit(appointment.id, { notes: n });
      store.pushToast({ title: 'Visit completed', msg: "Your notes were saved to the patient's medical records." });
      onCompleted?.(result);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete the visit. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Complete visit"
      subtitle={`${patientName} · ${appointment.appointment_date} at ${fmtTime12(appointment.start_time)}`}
      icon="stethoscope"
      iconKind="info"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className={`btn btn-primary${saving ? ' btn-loading' : ''}`} onClick={save} disabled={saving}>Save &amp; complete visit</button>
      </>}
    >
      {/* Clinical context — completed visits this patient already had with
          this doctor (first-time vs returning) */}
      {priorVisits !== null && (
        <div className="ctx-row">
          <span className="ctx-chip">
            {priorVisits === 0 ? 'First visit' : `Returning · ${priorVisits} prior visit${priorVisits === 1 ? '' : 's'}`}
          </span>
        </div>
      )}
      {/* Booking-time note from the patient (booking form "Additional notes")
          — the context the patient flagged for the doctor before the visit */}
      {appointment.additional_notes && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)', marginTop: 10 }}>
          <strong style={{ color: 'var(--text)' }}>Patient's booking note:</strong> {appointment.additional_notes}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)', marginTop: 10 }}>
          {error}
        </div>
      )}
      <Field
        label="Doctor's notes / visit summary"
        required
        error={error && notes.trim().length < 10 ? error : ''}
        help="You write these yourself. They are attributed to you and saved to the patient's medical records in their portal."
      >
        <TextArea
          rows={4}
          placeholder="e.g., Blood pressure well controlled on current medication. Continue lifestyle changes; repeat ECG in 6 months."
          value={notes}
          onChange={e => { setNotes(e.target.value); if (error) setError(''); }}
          error={error && notes.trim().length < 10 ? error : ''}
          maxLength={500}
        />
      </Field>
    </Modal>
  );
}

export { CompleteVisitModal };
export default CompleteVisitModal;
