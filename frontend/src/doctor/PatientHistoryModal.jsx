// PatientHistoryModal — doctor (Phase 5)
// Visit history ng isang pasyente (sariling appointments lang ng doctor) +
// medical records / lab results / medications + amended notes (ang doctor ay
// makaka-amend lang ng SARILING records).
import { useEffect, useState } from 'react';
import {
  Field, Icon, Modal, StatusBadge, TextArea, useStore,
} from '../shared/components.jsx';
import {
  api, getDoctorAppointment, getLabResults, getMedicalRecords, getMedications,
  updateMedicalRecord, ApiError,
} from '../shared/api.js';
import { fmtDateLong, fmtTime12 } from './helpers.js';

const MAX_NOTES = 2000;

function PatientHistoryModal({ open, onClose, patient }) {
  const store = useStore();
  // Ang doctor ay makaka-amend lang ng SARILING consultation records — ang
  // listahan ay nagpapakita ng shared history (lahat ng doctors ng pasyente),
  // pero ang PUT /records/medical/:id ay BOLA-scoped (→ 404 kapag hindi kanya).
  // Kung hindi ito i-gate dito, ang Save ay magpapakita lang ng
  // "Medical record not found" para sa records ng ibang doctor.
  const canAmend = (r) => !!r.doctor_id && r.doctor_id === store.doctorSession?.doctorId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visits, setVisits] = useState([]);
  const [records, setRecords] = useState([]);
  const [labs, setLabs] = useState([]);
  const [meds, setMeds] = useState([]);
  const [amendId, setAmendId] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [notesViewId, setNotesViewId] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    if (!open || !patient) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setAmendId(null);
    setNotesViewId(null);
    Promise.all([
      api(`/doctor/appointments?patient_id=${encodeURIComponent(patient.id)}`).then((d) => d.appointments || []),
      getMedicalRecords(patient.id),
      getLabResults(patient.id),
      getMedications(patient.id),
    ])
      .then(([appts, recs, labList, medList]) => {
        if (cancelled) return;
        setVisits(appts);
        setRecords(recs);
        setLabs(labList);
        setMeds(medList);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load patient history.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewNotes = async (apptId) => {
    setNotesLoading(true);
    setNotesViewId(apptId);
    try {
      const a = await getDoctorAppointment(apptId);
      setNotesText(a.notes || '');
    } catch (err) {
      setNotesText('');
      store.pushToast({ kind: 'error', title: 'Could not load notes', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setNotesLoading(false);
    }
  };

  const doAmend = async (recordId) => {
    const trimmed = draft.trim();
    if (trimmed.length < 1) {
      store.pushToast({ kind: 'error', title: 'Nothing to save', msg: 'Notes cannot be empty.' });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMedicalRecord(recordId, { summary: trimmed });
      setRecords(list => list.map(r => (r.id === recordId ? updated : r)));
      setAmendId(null);
      store.pushToast({ title: 'Notes amended', msg: 'The consultation record was updated.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not amend', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? patient.full_name : 'Patient history'}
      subtitle={patient ? `${patient.phone || ''}${patient.email ? ` · ${patient.email}` : ''}` : ''}
      icon="users-round"
      size="lg"
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <p className="t-muted" style={{ fontSize: 13.5 }}>Loading history…</p>
      ) : error ? (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
          {error}
        </div>
      ) : (
        <div className="stack lg">
          <section>
            <h3 className="h-section" style={{ marginBottom: 8 }}>Visit history</h3>
            {visits.length === 0 ? (
              <p className="t-muted" style={{ fontSize: 13.5 }}>No visits with you yet.</p>
            ) : (
              <div className="stack sm">
                {visits.slice().sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date))).map(v => (
                  <div key={v.id} className="card" style={{ background: 'var(--surface)' }}>
                    <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <strong>{fmtDateLong(v.appointment_date)}</strong>
                        <span className="t-muted" style={{ marginLeft: 8, fontSize: 13 }}>{fmtTime12(v.start_time)}</span>
                        <div className="t-muted" style={{ fontSize: 12.5 }}>{v.reason || '—'} · Ref {v.reference_code}</div>
                        {notesViewId === v.id && (
                          <div className="card" style={{ marginTop: 8, background: 'var(--surface-muted)' }}>
                            <div className="card-body" style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>
                              {notesLoading ? 'Loading notes…' : (notesText || <span className="t-muted">No notes recorded.</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                      <StatusBadge status={v.status} />
                      {v.status === 'completed' && notesViewId !== v.id && (
                        <button className="btn btn-ghost sm" onClick={() => viewNotes(v.id)}>
                          <Icon name="file-text" size={14} /> Notes
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="h-section" style={{ marginBottom: 8 }}>Consultation records</h3>
            {records.length === 0 ? (
              <p className="t-muted" style={{ fontSize: 13.5 }}>No consultation records yet.</p>
            ) : (
              <div className="stack sm">
                {records.map(r => (
                  <div key={r.id} className="card" style={{ background: 'var(--surface)' }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <strong>{r.title}</strong>
                          <div className="t-muted" style={{ fontSize: 12.5 }}>{r.visit_date} · {r.record_type}</div>
                        </div>
                        {amendId !== r.id && canAmend(r) && (
                          <button
                            className="btn btn-ghost sm"
                            onClick={() => { setAmendId(r.id); setDraft(r.summary || ''); }}
                          >
                            <Icon name="pencil" size={14} /> Amend notes
                          </button>
                        )}
                      </div>
                      {amendId === r.id ? (
                        <div style={{ marginTop: 10 }}>
                          <Field label="Amended notes" required>
                            <TextArea value={draft} onChange={e => setDraft(e.target.value)} maxLength={MAX_NOTES} rows={4} />
                          </Field>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="btn btn-ghost sm" onClick={() => setAmendId(null)} disabled={saving}>Cancel</button>
                            <button className={`btn btn-primary sm ${saving ? 'btn-loading' : ''}`} onClick={() => doAmend(r.id)} disabled={saving}>
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: 13.5, marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{r.summary}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="h-section" style={{ marginBottom: 8 }}>Lab results</h3>
            {labs.length === 0 ? (
              <p className="t-muted" style={{ fontSize: 13.5 }}>No lab results yet.</p>
            ) : (
              <div className="stack sm">
                {labs.map(l => (
                  <div key={l.id} className="card" style={{ background: 'var(--surface)' }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{l.test_name}</strong>
                          <div className="t-muted" style={{ fontSize: 12.5 }}>
                            {l.result_date} · {l.status === 'final' ? 'Final' : 'Pending'}{l.category ? ` · ${l.category}` : ''}
                          </div>
                        </div>
                      </div>
                      {(l.findings || []).length > 0 && (
                        <table className="table" style={{ marginTop: 8, fontSize: 13 }}>
                          <thead><tr><th>Item</th><th>Value</th><th>Flag</th></tr></thead>
                          <tbody>
                            {l.findings.map((f, i) => (
                              <tr key={i}>
                                <td>{f.item}</td>
                                <td>{f.value}{f.unit ? ` ${f.unit}` : ''}{f.range ? ` (${f.range})` : ''}</td>
                                <td>{f.flag === 'high' ? '↑ High' : f.flag === 'low' ? '↓ Low' : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="h-section" style={{ marginBottom: 8 }}>Medications</h3>
            {meds.length === 0 ? (
              <p className="t-muted" style={{ fontSize: 13.5 }}>No medications yet.</p>
            ) : (
              <div className="stack sm">
                {meds.map(m => (
                  <div key={m.id} className="card" style={{ background: 'var(--surface)' }}>
                    <div className="card-body">
                      <strong>{m.name}</strong>
                      <span className="t-muted" style={{ marginLeft: 8, fontSize: 13 }}>
                        {[m.dose, m.form, m.frequency].filter(Boolean).join(' · ')}
                      </span>
                      <div className="t-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                        {m.status === 'active' ? 'Active' : 'Completed'}{m.start_date ? ` · since ${m.start_date}` : ''}
                      </div>
                      {m.instructions && <p style={{ fontSize: 13.5, marginTop: 6, marginBottom: 0 }}>{m.instructions}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

export { PatientHistoryModal };
export default PatientHistoryModal;
