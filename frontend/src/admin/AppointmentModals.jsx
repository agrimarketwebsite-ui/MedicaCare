// AppointmentModals — admin appointment view/create/edit (restored prototype
// UI, real API).
// AppointmentDetailsModal(props: appointment, onClose) — read-only details.
// AppointmentFormModal(props: open, onClose, onSaved) — create new.
// AppointmentEditModal(props: appointment, onClose, onSaved) — edit existing.
import { useEffect, useState } from 'react';
import {
  Field, Modal, SelectInput, StatusBadge, TextArea, TextInput, useStore,
} from '../shared/components.jsx';
import { formatDate, statusMeta } from '../shared/data.js';
import {
  createAdminAppointment, getAdminDoctors, getAdminPatients,
  updateAdminAppointment, ApiError,
} from '../shared/api.js';
import { focusFirstError } from './helpers.js';

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

function AppointmentDetailsModal({ appointment, onClose }) {
  const appt = appointment;
  if (!appt) return null;
  const doctor = appt.doctor;
  const patient = appt.patient;
  const ref = appt.reference_code || appt.appointment_ref || '';
  const date = (appt.appointment_date || '').slice(0, 10);
  const time = (appt.start_time || '').slice(0, 5);

  return (
    <Modal
      open={!!appt}
      onClose={onClose}
      title={ref ? `Appointment ${ref}` : 'Appointment'}
      subtitle="Full appointment details."
      icon="calendar-days"
      size="md"
      footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}
    >
      <div className="stack md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={appt.status} />
          <span className="t-muted" style={{ fontSize: 12 }}>
            Created {appt.created_at ? formatDate(String(appt.created_at).slice(0, 10)) : '—'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div className="t-help">Patient</div>
            <div style={{ fontWeight: 600 }}>{patient?.full_name || appt.booked_for || 'Unknown'}</div>
            <div className="t-muted" style={{ fontSize: 12.5 }}>{patient?.email || '—'}</div>
          </div>
          <div>
            <div className="t-help">Doctor</div>
            <div style={{ fontWeight: 600 }}>{doctor?.full_name || 'Unknown'}</div>
            <div className="t-muted" style={{ fontSize: 12.5 }}>
              {doctor ? `${doctor.specialties?.name || ''}${doctor.room ? ` · ${doctor.room}` : ''}` : '—'}
            </div>
          </div>
          <div>
            <div className="t-help">Date & time</div>
            <div style={{ fontWeight: 600 }}>{date ? formatDate(date) : '—'} · {time || '—'}</div>
          </div>
          <div>
            <div className="t-help">Status</div>
            <div style={{ fontWeight: 600 }}>{(statusMeta(appt.status) || {}).label || appt.status}</div>
          </div>
          {appt.booked_for && patient?.full_name && appt.booked_for !== patient.full_name && (
            <div>
              <div className="t-help">Booked for</div>
              <div style={{ fontWeight: 600 }}>{appt.booked_for}</div>
            </div>
          )}
        </div>
        <div>
          <div className="t-help">Reason for visit</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{appt.reason || '—'}</div>
        </div>
        {appt.notes && (
          <div>
            <div className="t-help">Doctor's notes</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{appt.notes}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AppointmentFormModal({ open, onClose, onSaved }) {
  const store = useStore();
  const { patients, doctors } = useDirectory(open);
  const [form, setForm] = useState({ patient_id: '', doctor_id: '', date: '', start_time: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ patient_id: '', doctor_id: '', date: '', start_time: '', reason: '' });
      setErrors({});
      setSaving(false);
    }
  }, [open ]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };

  const submit = async () => {
    const e = {};
    if (!form.patient_id) e.patient_id = 'Please select a patient';
    if (!form.doctor_id) e.doctor_id = 'Please select a doctor';
    if (!form.date) e.date = 'Please pick a date';
    if (!form.start_time) e.start_time = 'Please pick a time slot';
    if (!form.reason.trim()) e.reason = 'Reason for visit is required';
    else if (form.reason.trim().length < 10) e.reason = 'Please provide a bit more detail (10+ characters)';
    setErrors(e);
    if (Object.keys(e).length) { focusFirstError(); return; }

    setSaving(true);
    try {
      await createAdminAppointment({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        appointment_date: form.date,
        start_time: form.start_time,
        reason: form.reason.trim(),
      });
      store.pushToast({ kind: 'success', title: 'Appointment created', message: 'The appointment has been added to the queue.' });
      onClose();
      onSaved && onSaved();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Could not create appointment.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New appointment"
      subtitle="Book a consultation on behalf of a patient."
      size="md"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create appointment'}</button>
      </>}
    >
      <div className="stack md">
        {errors.form && <div className="form-error">{errors.form}</div>}
        <Field label="Patient" required error={errors.patient_id}>
          <SelectInput value={form.patient_id} onChange={e => set('patient_id', e.target.value)} error={errors.patient_id}>
            <option value="">Select a patient…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Doctor" required error={errors.doctor_id}>
          <SelectInput value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)} error={errors.doctor_id}>
            <option value="">Select a doctor…</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.specialties?.name || d.specialty_name})</option>)}
          </SelectInput>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date" required error={errors.date}>
            <TextInput type="date" value={form.date} onChange={e => set('date', e.target.value)} error={errors.date} />
          </Field>
          <Field label="Time slot" required error={errors.start_time}>
            <TextInput type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} error={errors.start_time} />
          </Field>
        </div>
        <Field label="Reason for visit" required error={errors.reason}>
          <TextArea
            placeholder="e.g., Follow-up on blood pressure medication"
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            error={errors.reason}
            maxLength={500}
          />
        </Field>
      </div>
    </Modal>
  );
}

function AppointmentEditModal({ appointment, onClose, onSaved }) {
  const store = useStore();
  const { patients, doctors } = useDirectory(!!appointment);
  const [form, setForm] = useState({ doctor_id: '', date: '', start_time: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      setForm({
        doctor_id: appointment.doctor?.id || appointment.doctor_id || '',
        date: (appointment.appointment_date || '').slice(0, 10),
        start_time: (appointment.start_time || '').slice(0, 5),
        reason: appointment.reason || '',
      });
      setErrors({});
      setSaving(false);
    }
  }, [appointment]);

  if (!appointment) return null;
  const ref = appointment.reference_code || appointment.appointment_ref || '';

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };

  const submit = async () => {
    const e = {};
    if (!form.doctor_id) e.doctor_id = 'Please select a doctor';
    if (!form.date) e.date = 'Please pick a date';
    if (!form.start_time) e.start_time = 'Please pick a time slot';
    if (!form.reason.trim()) e.reason = 'Reason for visit is required';
    setErrors(e);
    if (Object.keys(e).length) { focusFirstError(); return; }

    setSaving(true);
    try {
      await updateAdminAppointment(appointment.id, {
        doctor_id: form.doctor_id,
        appointment_date: form.date,
        start_time: form.start_time,
        reason: form.reason.trim(),
      });
      store.pushToast({ kind: 'success', title: 'Appointment updated', message: `Ref ${ref} has been updated.` });
      onClose();
      onSaved && onSaved();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Could not update appointment.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit appointment"
      subtitle={`Ref ${ref} · ${appointment.patient?.full_name || appointment.booked_for || 'Patient'}`}
      icon="pencil"
      size="md"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </>}
    >
      <div className="stack md">
        {errors.form && <div className="form-error">{errors.form}</div>}
        <Field label="Doctor" required error={errors.doctor_id}>
          <SelectInput value={form.doctor_id} onChange={e => set('doctor_id', e.target.value)} error={errors.doctor_id}>
            <option value="">Select a doctor…</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.specialties?.name || d.specialty_name})</option>)}
          </SelectInput>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date" required error={errors.date}>
            <TextInput type="date" value={form.date} onChange={e => set('date', e.target.value)} error={errors.date} />
          </Field>
          <Field label="Time slot" required error={errors.start_time}>
            <TextInput type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} error={errors.start_time} />
          </Field>
        </div>
        <Field label="Reason for visit" required error={errors.reason}>
          <TextArea value={form.reason} onChange={e => set('reason', e.target.value)} error={errors.reason} maxLength={500} />
        </Field>
      </div>
    </Modal>
  );
}

export { AppointmentEditModal, AppointmentFormModal, AppointmentDetailsModal };
