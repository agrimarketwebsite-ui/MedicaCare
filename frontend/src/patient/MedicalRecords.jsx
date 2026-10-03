// MedicalRecords — patient (split from screens-patient.jsx)
import { useEffect, useState } from 'react';
import { AppShell, Badge, EmptyState, Icon, Modal, navigate, PageHeader, SelectInput, SkeletonRows, useStore } from '../shared/components.jsx';
import { getAppointments } from '../shared/api.js';

import { buildRecordsHTML, downloadFile, localToday, toFrontendAppt } from './helpers.js';

// ---------- Medical Records ----------
// Records derive from the patient's real completed appointments (Phase 4 API);
// lab results and medications are added by clinic staff (no patient-facing
// API endpoint — the tables show honest empty states until staff add entries).
function MedicalRecords() {
  const store = useStore();
  const me = store.currentPatient || window.CURRENT_PATIENT;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [completed, setCompleted] = useState([]);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [viewLab, setViewLab] = useState(null);
  const today = localToday();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getAppointments('completed')
      .then((list) => {
        if (cancelled) return;
        setCompleted((list || []).map(toFrontendAppt).filter(Boolean));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Could not load your records. Please try again.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Records come from real completed visits: when staff mark an appointment
  // completed, that visit lands here automatically (no hardcoded demo list)
  const records = completed
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(a => ({
      id: a.id,
      date: a.date,
      type: 'Consultation',
      doctorId: a.doctorId,
      doctorName: a.doctorName,
      title: a.reason,
      summary: a.additionalNotes || 'No consultation notes were recorded for this visit.',
    }));
  const recordDoctors = [...new Map(records.map(r => [r.doctorId, r.doctorName])).entries()]
    .map(([id, name]) => ({ id, name: name || (window.findDoctor(id) || {}).name || '—' }))
    .filter(d => d.id);
  const filteredRecords = doctorFilter === 'all'
    ? records
    : records.filter(r => String(r.doctorId) === String(doctorFilter));

  // Lab results + medications — staff-encoded entries (no patient-facing API
  // endpoint; the store holds local entries only, so real patients see the
  // honest empty states below until staff add entries via a staff endpoint).
  const labs = [];
  const meds = [];

  // Billing summary — a record of bills, NOT a payment portal: consultation
  // fees are settled at the cashier during the visit. Visits completed today
  // haven't been to the cashier yet, so they read as "Settle at cashier";
  // older ones are Paid receipts. Official receipts live on each
  // appointment's details page.
  const bills = completed
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(a => ({
      id: a.id,
      date: a.date,
      service: a.reason,
      doctor: a.doctorName || '—',
      amount: Number(a.doctorFee) || 0,
      status: a.date < today ? 'Paid' : 'Settle at cashier',
    }));
  const totalPaid = bills.filter(b => b.status === 'Paid').reduce((s, b) => s + b.amount, 0);
  const totalDue = bills.filter(b => b.status !== 'Paid').reduce((s, b) => s + b.amount, 0);

  const downloadRecords = () => {
    downloadFile(`medicacare-records-${me.id || 'patient'}.html`, buildRecordsHTML(me, records, meds, labs, bills), 'text/html;charset=utf-8');
    store.pushToast({ title: 'Records downloaded', msg: 'Open the file to view or print your full medical summary.' });
  };

  const bloodType = me.blood_type || me.bloodType || '—';
  const allergies = me.allergies || 'None';
  const emergencyContact = me.emergency_contact || me.emergencyContact || '—';

  return (
    <AppShell current="records">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="Medical records"
          subtitle={loading
            ? <span className="skel" aria-hidden="true" style={{ width: 280, maxWidth: '100%', height: 14 }} />
            : "Visits, lab results, medications, and billing — everything from your completed appointments."}
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Medical records' }]}
          actions={<button className="btn btn-secondary" onClick={downloadRecords}><Icon name="download" size={14} /> Download records</button>}
        />

        {loadError && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <EmptyState icon="alert-triangle" title="Couldn't load your records" message={loadError}
                actions={<button className="btn btn-secondary" onClick={() => window.location.reload()}>Try again</button>} />
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Health summary</h2></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {loading ? (
                [0, 1, 2].map(i => (
                  <div key={i} aria-hidden="true">
                    <span className="skel" style={{ width: 90, height: 11, display: 'block', marginBottom: 9 }} />
                    <span className="skel" style={{ width: '60%', height: 14, display: 'block' }} />
                  </div>
                ))
              ) : (
                <>
                  <div>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>Blood type</div>
                    <div style={{ fontWeight: 600 }}>{bloodType}</div>
                  </div>
                  <div>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>Known allergies</div>
                    <div style={{ fontWeight: 600 }}>{allergies}</div>
                  </div>
                  <div>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>Emergency contact</div>
                    <div style={{ fontWeight: 600 }}>{emergencyContact}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Billing summary — computed from completed visits (consultation fees) */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Billing summary</h2></div>
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="billing-stats">
              {loading ? (
                [0, 1, 2].map(i => (
                  <div key={i} aria-hidden="true">
                    <span className="skel" style={{ width: 90, height: 11, display: 'block', marginBottom: 9 }} />
                    <span className="skel" style={{ width: '55%', height: 16, display: 'block' }} />
                  </div>
                ))
              ) : (
                <>
                  <div>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>Total paid</div>
                    <div style={{ fontWeight: 600, fontSize: 18 }}>₱{totalPaid.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>To settle at cashier</div>
                    <div style={{ fontWeight: 600, fontSize: 18 }}>
                      {totalDue ? `₱${totalDue.toLocaleString()}` : '₱0 — all settled'}
                    </div>
                  </div>
                  <div>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>Invoices</div>
                    <div style={{ fontWeight: 600, fontSize: 18 }}>{bills.length}</div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table table-responsive-stack records-table">
                <thead><tr><th>Date</th><th>Service</th><th>Doctor</th><th>Amount</th><th>Status</th><th className="col-actions">Receipt</th></tr></thead>
                <tbody>
                  {loading ? <SkeletonRows rows={3} cols={6} /> : bills.length === 0 ? (
                    <tr><td colSpan={6} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="receipt" title="No bills yet" message="A bill appears here once a visit is completed." />
                    </td></tr>
                  ) : bills.map(b => (
                    <tr key={b.id}>
                      <td data-label="Date">{window.formatDate(b.date)}</td>
                      <td data-label="Service" className="cell-primary-truncate" style={{ maxWidth: 220 }}>{b.service}</td>
                      <td data-label="Doctor" className="td-nowrap">{b.doctor}</td>
                      <td data-label="Amount" className="td-nowrap">₱{b.amount.toLocaleString()}</td>
                      <td data-label="Status"><Badge kind={b.status === 'Paid' ? 'success' : 'warning'} dot={false}>{b.status}</Badge></td>
                      <td className="col-actions"><button className="btn btn-ghost sm" onClick={() => navigate('/patient/appointment/' + b.id)}><Icon name="eye" size={14} /> View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="t-help" style={{ padding: '10px 20px 16px', margin: 0 }}>
            This is a record of your bills, not a payment portal — consultation fees are settled at the cashier during your visit. Download the official receipt from each appointment's details page.
          </p>
        </div>

        {/* Medications — added by clinic staff */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Medications</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table table-responsive-stack records-table">
                <thead><tr><th>Medicine</th><th>Dose / form</th><th>Frequency</th><th>Prescriber</th><th>Status</th></tr></thead>
                <tbody>
                  {loading ? <SkeletonRows rows={3} cols={5} /> : meds.length === 0 ? (
                    <tr><td colSpan={5} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="pill" title="No medications on file" message="Prescriptions from your visits will appear here." />
                    </td></tr>
                  ) : meds.map(m => {
                    const doc = window.findDoctor(m.prescriberId);
                    return (
                      <tr key={m.id}>
                        <td data-label="Medicine">
                          <div className="cell-primary">{m.name}</div>
                          <div className="cell-secondary">{m.instructions}</div>
                        </td>
                        <td data-label="Dose / form">{m.dose} · {m.form}</td>
                        <td data-label="Frequency">{m.frequency}</td>
                        <td data-label="Prescriber" className="td-nowrap">{doc ? doc.name : '—'}</td>
                        <td data-label="Status"><Badge kind={m.status === 'Active' ? 'success' : 'neutral'} dot={false}>{m.status}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="t-help" style={{ padding: '10px 20px 16px', margin: 0 }}>
            Medications are added by clinic staff.
          </p>
        </div>

        {/* Lab results — added by clinic staff */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Lab results</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table table-responsive-stack records-table">
                <thead><tr><th>Date</th><th>Test</th><th>Category</th><th>Findings</th><th className="col-actions">Details</th></tr></thead>
                <tbody>
                  {loading ? <SkeletonRows rows={3} cols={5} /> : labs.length === 0 ? (
                    <tr><td colSpan={5} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState icon="flask-conical" title="No lab results yet" message="Results from your lab visits will appear here once released." />
                    </td></tr>
                  ) : labs.map(l => {
                    const flagged = l.results.filter(r => r.flag === 'high' || r.flag === 'low').length;
                    return (
                      <tr key={l.id}>
                        <td data-label="Date">{window.formatDate(l.date)}</td>
                        <td data-label="Test" className="cell-primary">{l.name}</td>
                        <td data-label="Category">{l.category}</td>
                        <td data-label="Findings">
                          {flagged
                            ? <span style={{ color: 'var(--warning-text)', fontWeight: 500 }}>{flagged} finding{flagged === 1 ? '' : 's'} outside range</span>
                            : <span style={{ color: 'var(--success-text)' }}>All within range</span>}
                        </td>
                        <td className="col-actions"><button className="btn btn-ghost sm" onClick={() => setViewLab(l)}><Icon name="eye" size={14} /> View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="t-help" style={{ padding: '10px 20px 16px', margin: 0 }}>
            Lab results are added by clinic staff.
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="h-section">Records</h2>
            {!loading && recordDoctors.length > 1 && (
              <SelectInput value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Filter records by doctor" style={{ maxWidth: 240 }}>
                <option value="all">All doctors</option>
                {recordDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </SelectInput>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table table-responsive-stack records-table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Doctor</th><th>Record</th></tr>
                </thead>
                <tbody>
                  {loading ? <SkeletonRows rows={4} cols={4} /> : filteredRecords.length === 0 ? (
                    <tr><td colSpan={4} className="empty-cell" style={{ padding: 0 }}>
                      <EmptyState
                        icon="file-text"
                        title="No medical records yet"
                        message={records.length === 0
                          ? "Records appear here once a visit is completed and staff add the doctor's notes."
                          : 'No records for the selected doctor.'}
                      />
                    </td></tr>
                  ) : filteredRecords.map(r => (
                    <tr key={r.id}>
                      <td data-label="Date">{window.formatDate(r.date)}</td>
                      <td data-label="Type">{r.type}</td>
                      <td data-label="Doctor">{r.doctorName || '—'}</td>
                      <td className="record-cell" data-label="Record">
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        <div className="t-muted" style={{ fontSize: 12.5 }}>{r.summary}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="t-muted" style={{ fontSize: 12, marginTop: 12 }}>
          Note: records come from your completed appointments — our staff adds the doctor's notes when marking a visit complete.
        </p>
      </div>

      {/* Lab result detail */}
      <Modal
        open={!!viewLab}
        onClose={() => setViewLab(null)}
        title={viewLab ? viewLab.name : ''}
        subtitle={viewLab ? `${window.formatDate(viewLab.date)} · ${viewLab.category} · ${viewLab.status}` : ''}
        icon="flask-conical" iconKind="info"
        footer={<button className="btn btn-secondary" onClick={() => setViewLab(null)}>Close</button>}
      >
        {viewLab && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Result</th><th>Reference range</th></tr></thead>
              <tbody>
                {viewLab.results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.item}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: (r.flag === 'high' || r.flag === 'low') ? 'var(--error)' : undefined }}>
                        {r.value} {r.unit}
                      </span>
                      {(r.flag === 'high' || r.flag === 'low') && (
                        <span className="lab-flag" style={{ marginLeft: 8 }}>{r.flag.toUpperCase()}</span>
                      )}
                    </td>
                    <td className="t-muted">{r.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

export { MedicalRecords };
