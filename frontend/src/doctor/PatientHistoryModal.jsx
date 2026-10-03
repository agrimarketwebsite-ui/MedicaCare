// PatientHistoryModal — doctor portal
// Patient chart history: the doctor's own appointments with this patient,
// plus consultation records from other doctors (shared chart). Each visit
// shows the doctor's name, status, reason, and notes for completed visits.
import { useEffect, useState } from 'react';
import { EmptyState, Modal, StatusBadge, useStore } from '../shared/components.jsx';
import { api, getMedicalRecords, ApiError } from '../shared/api.js';
import { fmtTime12, useDoctor } from './helpers.js';

function PatientHistoryModal({ patient, onClose }) {
  const store = useStore();
  const me = useDoctor();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api(`/doctor/appointments?patient_id=${encodeURIComponent(patient.id)}`).then((d) => d.appointments || []),
      getMedicalRecords(patient.id).catch(() => []),
    ])
      .then(([appts, records]) => {
        if (cancelled) return;
        // Own appointments (all statuses)
        const own = appts.map(a => ({
          id: a.id,
          date: a.appointment_date,
          time: fmtTime12(a.start_time),
          doctorName: me.name,
          status: a.status,
          reason: a.reason,
          notes: a.notes,
        }));
        // Records from other doctors (shared chart) — as completed visits
        const otherDoctorIds = new Set(appts.map(a => a.doctor_id).filter(Boolean));
        const others = (records || [])
          .filter(r => r.doctor_id && !otherDoctorIds.has(r.doctor_id))
          .map(r => {
            const doc = window.findDoctor ? window.findDoctor(r.doctor_id) : null;
            return {
              id: r.id,
              date: r.visit_date,
              time: '',
              doctorName: doc?.name || 'Doctor',
              status: 'completed',
              reason: r.title,
              notes: r.summary,
            };
          });
        const all = [...own, ...others].sort((a, b) =>
          String(b.date).localeCompare(String(a.date)) || String(b.time).localeCompare(String(a.time)));
        setVisits(all);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load patient history.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return null;
  const patientName = patient.full_name || patient.name || 'Patient';
  const contact = [patient.phone, patient.email].filter(Boolean).join(' · ');

  return (
    <Modal
      open
      onClose={onClose}
      title={patientName}
      subtitle={contact}
      icon="user-round"
      iconKind="info"
      size="md"
      footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : error ? (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
          {error}
        </div>
      ) : visits.length === 0 ? (
        <EmptyState icon="calendar-x" title="No appointment history" message="This patient has no past or upcoming visits yet." />
      ) : (
        <div className="stack md">
          {visits.map(a => (
            <div key={a.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.date}{a.time ? ` · ${a.time}` : ''}</span>
                <span className="t-muted" style={{ fontSize: 12.5 }}>{a.doctorName}</span>
                <span style={{ marginLeft: 'auto' }}><StatusBadge status={a.status} /></span>
              </div>
              <div className="t-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.reason || '—'}</div>
              {a.status === 'completed' && a.notes && (
                <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5, background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                  {a.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export { PatientHistoryModal };
export default PatientHistoryModal;
