// PatientRecordsModal — read-only patient summary (Phase 6).
// Props: open, onClose, patient. Profile + counts (appointments / medical
// records / labs / medications). Keep simple — full records live in the
// doctor portal and patient profile.
import { useEffect, useState } from 'react';
import { EmptyState, Icon, Modal, PageSpinner } from '../shared/components.jsx';
import { getAdminLabs, getAdminMeds, getAdminPatient } from '../shared/api.js';

function StatCell({ label, value }) {
  return (
    <div className="stat-cell">
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PatientRecordsModal({ open, onClose, patient }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  // Tanging patient-scoped counts lang ang ipinapakita — ang appointments
  // list endpoint ay walang patient filter, kaya hindi ito binibilang dito.
  const [counts, setCounts] = useState({ labs: 0, meds: 0 });

  useEffect(() => {
    if (!open || !patient?.id) return;
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    (async () => {
      try {
        const [p, labs, meds] = await Promise.all([
          getAdminPatient(patient.id).catch(() => null),
          getAdminLabs(patient.id).catch(() => []),
          getAdminMeds(patient.id).catch(() => []),
        ]);
        if (cancelled) return;
        setDetail(p || patient);
        setCounts({ labs: labs.length, meds: meds.length });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, patient]);

  const d = detail || patient || {};
  const rows = [
    ['Full name', d.full_name],
    ['Email', d.email],
    ['Phone', d.phone],
    ['Gender', d.gender],
    ['Date of birth', d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : null],
    ['Blood type', d.blood_type],
    ['Allergies', d.allergies],
    ['Address', d.address],
    ['Emergency contact', d.emergency_contact],
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Patient record"
      subtitle={d.full_name || ''}
      icon="folder-open"
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <PageSpinner />
      ) : !patient ? (
        <EmptyState icon="user" title="No patient selected" />
      ) : (
        <>
          <div className="stat-row" style={{ marginBottom: 16 }}>
            <StatCell label="Lab results" value={counts.labs} />
            <StatCell label="Medications" value={counts.meds} />
          </div>
          <table className="detail-table">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td className="t-muted">{v || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="field-help" style={{ marginTop: 12 }}>
            <Icon name="info" size={13} /> Full visit history and clinical records are
            available in the doctor portal; labs and medications are managed in the
            doctor console for this patient.
          </div>
        </>
      )}
    </Modal>
  );
}

export { PatientRecordsModal };
