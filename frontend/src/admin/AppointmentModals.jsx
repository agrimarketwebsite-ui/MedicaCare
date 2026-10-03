// AppointmentModals — admin appointment create/edit + status change (Phase 6).
// AppointmentFormModal(props: open, onClose, initial?, onSaved)
//   Fields: patient_id, doctor_id, date, start_time, reason. Ang patient at
//   doctor dropdowns ay kino-load ng modal mismo (limit 100) para
//   self-contained ito.
// AppointmentStatusModal(props: open, onClose, appointment, onSaved)
//   Status picker + notes. Kapag 'completed' → completeAdminAppointment
//   (kailangan ng notes, min. 10 chars); ibang status → setAdminAppointmentStatus.
import { useEffect, useState } from 'react';
import { Field, Modal, SelectInput, TextArea, TextInput, useStore } from '../shared/components.jsx';
import {
  completeAdminAppointment, createAdminAppointment, getAdminDoctors,
  getAdminPatients, setAdminAppointmentStatus, updateAdminAppointment, ApiError,
} from '../shared/api.js';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];

function useDirectory(open) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAdminPatients('', 1, 100).then((r) => { if (!cancelled) setPatients(r.patients); }).catch(() => {});
    getAdminDoctors('', 1, 100).then((r) => { if (!cancelled) setDoctors(r.doctors); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);
  return { patients, doctors };
}

function AppointmentFormModal({ open, onClose, initial, onSaved }) {
  const store = useStore();
  const editing = Boolean(initial?.id);
  const { patients, doctors } = useDirectory(open);
  const [form, setForm] = useState({ patient_id: '', doctor_id: '', date: '', start_time: '', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? {
      patient_id: initial.patient?.id || initial.patient_id || '',
      doctor_id: initial.doctor?.id || initial.doctor_id || '',
      date: (initial.appointment_date || '').slice(0, 10),
      start_time: (initial.start_time || '').slice(0, 5),
      reason: initial.reason || '',
    } : { patient_id: '', doctor_id: '', date: '', start_time: '', reason: '' });
    setError('');
    setSaving(false);
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const doSave = async () => {
    if (!form.patient_id) { setError('Choose a patient.'); return; }
    if (!form.doctor_id) { setError('Choose a doctor.'); return; }
    if (!form.date) { setError('Choose a date.'); return; }
    if (!form.start_time) { setError('Choose a start time.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        appointment_date: form.date,
        start_time: form.start_time,
        reason: form.reason.trim() || null,
      };
      const saved = editing
        ? await updateAdminAppointment(initial.id, body)
        : await createAdminAppointment(body);
      store.pushToast({
        kind: 'success',
        title: editing ? 'Appointment updated' : 'Appointment created',
        message: `Appointment ${saved.reference_code || saved.appointment_ref || ''} has been ${editing ? 'updated' : 'booked'}.`.trim(),
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the appointment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit appointment' : 'New appointment'}
      subtitle={editing ? `Appointment ${initial?.reference_code || initial?.appointment_ref || ''}` : 'Book an appointment on behalf of a patient.'}
      icon="calendar-plus"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={doSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Book appointment'}
          </button>
        </>
      }
    >
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Patient" required>
          <SelectInput value={form.patient_id} onChange={set('patient_id')} disabled={editing}>
            <option value="">— Select patient —</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Doctor" required>
          <SelectInput value={form.doctor_id} onChange={set('doctor_id')}>
            <option value="">— Select doctor —</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.specialty_name ? ` — ${d.specialty_name}` : ''}</option>)}
          </SelectInput>
        </Field>
        <Field label="Date" required>
          <TextInput type="date" value={form.date} onChange={set('date')} />
        </Field>
        <Field label="Start time" required>
          <TextInput type="time" value={form.start_time} onChange={set('start_time')} />
        </Field>
        <Field label="Reason">
          <TextArea value={form.reason} onChange={set('reason')} rows={2} maxLength={500} placeholder="Reason for visit…" />
        </Field>
      </div>
    </Modal>
  );
}

function AppointmentStatusModal({ open, onClose, appointment, onSaved }) {
  const store = useStore();
  const [status, setStatus] = useState('confirmed');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(appointment?.status || 'confirmed');
    setNotes('');
    setError('');
    setSaving(false);
  }, [open, appointment]);

  if (!appointment) return null;
  const who = appointment.patient?.full_name || appointment.booked_for || 'Patient';

  const doSave = async () => {
    if (status === 'completed' && notes.trim().length < 10) {
      setError('Visit notes are required to complete a visit (at least 10 characters).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = status === 'completed'
        ? await completeAdminAppointment(appointment.id, { notes: notes.trim() })
        : await setAdminAppointmentStatus(appointment.id, { status });
      store.pushToast({
        kind: 'success',
        title: 'Status updated',
        message: `${who}'s appointment is now ${status}.`,
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the status. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change status"
      subtitle={`${who} · ${(appointment.appointment_date || '').slice(0, 10)}`}
      icon="refresh-cw"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={doSave} disabled={saving}>
            {saving ? 'Saving…' : 'Update status'}
          </button>
        </>
      }
    >
      {error && <div className="form-error" role="alert">{error}</div>}
      <Field label="Status" required>
        <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
      </Field>
      <Field
        label="Visit notes"
        required={status === 'completed'}
        help={status === 'completed' ? 'Required when completing a visit — saved to the consultation record.' : 'Optional notes for this status change.'}
      >
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
      </Field>
    </Modal>
  );
}

export { AppointmentFormModal, AppointmentStatusModal };
