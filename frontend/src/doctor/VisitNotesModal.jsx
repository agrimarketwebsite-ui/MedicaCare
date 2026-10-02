// VisitNotesModal — doctor (Phase 5)
// Ipinapakita ang visit notes ng isang completed appointment. Ang doctor ay
// pwedeng mag-amend sa pamamagitan ng linked medical record (ang summary
// nito ang naka-sync sa notes) — "amended notes".
import { useEffect, useState } from 'react';
import { Field, Icon, Modal, TextArea, useStore } from '../shared/components.jsx';
import { getDoctorAppointment, updateMedicalRecord, ApiError } from '../shared/api.js';
import { fmtTime12 } from './helpers.js';

const MAX_NOTES = 500;

function VisitNotesModal({ open, onClose, appointmentId, onAmended }) {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !appointmentId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setEditing(false);
    getDoctorAppointment(appointmentId)
      .then((a) => { if (!cancelled) { setDetail(a); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message || 'Could not load visit notes.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [open, appointmentId]);

  const record = detail?.medical_record || null;
  const patientName = detail?.patient?.full_name || detail?.booked_for || 'Patient';
  // Ang consultation record summary ang "living" na notes (pwedeng i-amend);
  // ang appointment.notes ay ang visit-time snapshot. Ipakita ang summary
  // kapag meron, fallback sa notes.
  const shownNotes = record?.summary || detail?.notes || '';

  const startEdit = () => {
    setDraft(shownNotes);
    setEditing(true);
    setError('');
  };

  const doAmend = async () => {
    const trimmed = draft.trim();
    if (trimmed.length < 10) {
      setError('Amended notes must be at least 10 characters.');
      return;
    }
    if (!record) {
      setError('No linked consultation record to amend.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateMedicalRecord(record.id, { summary: trimmed });
      setDetail(d => ({ ...d, medical_record: updated }));
      store.pushToast({ title: 'Notes amended', msg: 'The consultation record was updated.' });
      setEditing(false);
      onAmended?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not amend the notes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Visit notes"
      subtitle={detail ? `${patientName} · ${detail.appointment_date} at ${fmtTime12(detail.start_time)}` : 'Loading…'}
      icon="file-text"
      footer={
        editing ? (
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={doAmend} disabled={saving}>
              Save amended notes
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            {record && !loading && (
              <button className="btn btn-secondary" onClick={startEdit}>
                <Icon name="pencil" size={14} /> Amend notes
              </button>
            )}
          </>
        )
      }
    >
      {loading ? (
        <div
          role="status"
          aria-label="Loading"
          style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div className="spinner" />
        </div>
      ) : error && !detail ? (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
          {error}
        </div>
      ) : (
        <div className="stack md">
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
              {error}
            </div>
          )}
          {editing ? (
            <Field label="Amended notes" required help="Updates the linked consultation record.">
              <TextArea value={draft} onChange={e => setDraft(e.target.value)} maxLength={MAX_NOTES} rows={6} />
              <div className="t-help" style={{ textAlign: 'right', marginTop: -4 }}>{draft.trim().length}/{MAX_NOTES}</div>
            </Field>
          ) : (
            <div className="card" style={{ background: 'var(--surface-muted)' }}>
              <div className="card-body" style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {shownNotes || <span className="t-muted">No notes recorded for this visit.</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export { VisitNotesModal };
export default VisitNotesModal;
