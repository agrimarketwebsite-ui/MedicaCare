// CompleteVisitModal — doctor (Phase 5)
// Iko-complete ang visit: required ang visit notes (10–500 chars, [ENC] sa
// backend). Ang pag-complete ay gumagawa rin ng medical_records row
// (record_type 'Consultation') — makikita ito ng patient sa Medical Records.
import { useEffect, useState } from 'react';
import { Field, Icon, Modal, TextArea, useStore } from '../shared/components.jsx';
import { completeVisit, ApiError } from '../shared/api.js';
import { fmtTime12 } from './helpers.js';

const MIN_NOTES = 10;
const MAX_NOTES = 500;

function CompleteVisitModal({ open, onClose, appointment, onCompleted }) {
  const store = useStore();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes('');
      setError('');
      setSaving(false);
    }
  }, [open, appointment?.id]);

  if (!appointment) return null;
  const patientName = appointment.patient?.full_name || appointment.booked_for || 'Patient';

  const doComplete = async () => {
    const trimmed = notes.trim();
    if (trimmed.length < MIN_NOTES) {
      setError(`Visit notes must be at least ${MIN_NOTES} characters.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await completeVisit(appointment.id, { notes: trimmed });
      store.pushToast({ title: 'Visit completed', msg: `A consultation record was saved for ${patientName}.` });
      onCompleted?.(result);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete the visit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete visit"
      subtitle={`${patientName} · ${appointment.appointment_date} at ${fmtTime12(appointment.start_time)}`}
      icon="clipboard-check"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}
            disabled={saving || notes.trim().length < MIN_NOTES}
            onClick={doComplete}
          >
            Complete visit
          </button>
        </>
      }
    >
      <div className="stack md">
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, background: 'var(--surface-muted)', fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <Icon name="info" size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>Completing this visit sets the appointment to <strong>completed</strong> and creates a consultation record the patient can see. The patient will then be able to rate this visit.</span>
        </div>
        <Field
          label="Visit notes"
          required
          error={notes.trim().length > 0 && notes.trim().length < MIN_NOTES ? `At least ${MIN_NOTES} characters` : null}
          help="Diagnosis, findings, and plan. Encrypted at rest."
        >
          <TextArea
            placeholder="e.g., Upper respiratory tract infection. Advised rest and increased fluid intake for one week…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={MAX_NOTES}
            rows={5}
          />
          <div className="t-help" style={{ textAlign: 'right', marginTop: -4 }}>{notes.trim().length}/{MAX_NOTES}</div>
        </Field>
      </div>
    </Modal>
  );
}

export { CompleteVisitModal };
export default CompleteVisitModal;
