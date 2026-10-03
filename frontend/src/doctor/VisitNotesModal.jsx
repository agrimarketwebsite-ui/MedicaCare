// VisitNotesModal — doctor portal
// View and amend the doctor's own notes. Completed visits are read-only in
// the UI until the doctor chooses to edit; amendments flow straight to the
// patient's medical records (same field).
import { useEffect, useState } from 'react';
import { Field, Modal, TextArea, useStore } from '../shared/components.jsx';
import { getDoctorAppointment, updateMedicalRecord, ApiError } from '../shared/api.js';
import { fmtTime12, focusFirstError } from './helpers.js';

function VisitNotesModal({ appointment, onClose, onAmended }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (appointment) {
      setEditing(false);
      setNotes(appointment.notes || '');
      setError('');
      setSaving(false);
      setDetail(null);
      // Fetch the full detail (notes + linked consultation record) so
      // amendments go to the right place.
      let cancelled = false;
      setLoading(true);
      getDoctorAppointment(appointment.id)
        .then((d) => {
          if (cancelled) return;
          const a = d.appointment || d;
          setDetail(a);
          setNotes(a.medical_record?.summary || a.notes || '');
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
  }, [appointment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!appointment) return null;
  const patientName = appointment.patient?.full_name || appointment.booked_for || 'Patient';
  const record = detail?.medical_record || null;
  // The doctor can only amend their own consultation records.
  const canAmend = !!record && !!record.doctor_id && record.doctor_id === store.doctorSession?.doctorId;

  const save = async () => {
    const n = notes.trim();
    if (n.length < 10) {
      setError('Please write the visit summary (10+ characters).');
      focusFirstError();
      return;
    }
    if (!record) {
      setError('No linked consultation record to amend.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateMedicalRecord(record.id, { summary: n });
      store.pushToast({ title: 'Notes updated', msg: "The amended notes were saved to the patient's medical records." });
      onAmended?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Doctor's notes"
      subtitle={`${patientName} · ${appointment.appointment_date}`}
      icon="stethoscope"
      iconKind="info"
      footer={editing ? (
        <>
          <button className="btn btn-secondary" onClick={() => { setEditing(false); setError(''); }} disabled={saving}>Cancel</button>
          <button className={`btn btn-primary${saving ? ' btn-loading' : ''}`} onClick={save} disabled={saving}>Save changes</button>
        </>
      ) : (
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {canAmend && !loading && (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit notes</button>
          )}
        </>
      )}
    >
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)', marginBottom: 10 }}>
          {error}
        </div>
      )}
      {editing ? (
        <Field
          label="Doctor's notes / visit summary"
          required
          error={error}
          help="Amendments are saved to the patient's medical records immediately."
        >
          <TextArea
            rows={4}
            value={notes}
            onChange={e => { setNotes(e.target.value); if (error) setError(''); }}
            error={error}
            maxLength={500}
          />
        </Field>
      ) : (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
          {loading ? 'Loading…' : (detail?.medical_record?.summary || detail?.notes || appointment.notes || 'No consultation notes were recorded for this visit.')}
        </p>
      )}
    </Modal>
  );
}

export { VisitNotesModal };
export default VisitNotesModal;
