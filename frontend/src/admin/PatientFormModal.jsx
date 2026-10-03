// PatientFormModal — add patient (restored prototype UI, real API).
// Props: open, onClose, onSaved(). Add-only; personal info is owned by the
// patient via their Profile page. The prototype's photo upload is omitted:
// the backend's photo_url field accepts only a short URL (storage upload
// endpoint TBD) and base64 data-URLs fail validation — the registry lists
// render PatientAvatar instead.
import { useEffect, useState } from 'react';
import { Field, Icon, Modal, SelectInput, TextInput, useStore } from '../shared/components.jsx';
import { createAdminPatient, ApiError } from '../shared/api.js';
import { focusFirstError } from './helpers.js';

function PatientFormModal({ open, onClose, onSaved }) {
  const store = useStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', gender: 'male', dob: '', password: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', phone: '', gender: 'male', dob: '', password: '' });
      setErrors({});
      setSaving(false);
    }
  }, [open]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };

  const submit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Min. 8 characters';
    setErrors(e);
    if (Object.keys(e).length) { focusFirstError(); return; }

    setSaving(true);
    try {
      await createAdminPatient({
        full_name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        gender: form.gender || undefined,
        date_of_birth: form.dob || undefined,
      });
      store.pushToast({ title: 'Patient added', msg: `${form.name.trim()} has been added to the registry.` });
      onClose();
      onSaved && onSaved();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not add patient.';
      setErrors({ form: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add new patient"
      subtitle="Enter the new patient's details to create a record."
      size="md"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add patient'}</button>
      </>}
    >
      <div className="stack md">
        {errors.form && <div className="form-error"><Icon name="alert-circle" size={14} /> {errors.form}</div>}
        <Field label="Full name" required error={errors.name}>
          <TextInput value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} placeholder="e.g., Juan dela Cruz" />
        </Field>
        <Field label="Email" required error={errors.email} help="Used for the patient's portal login">
          <TextInput type="email" icon="mail" value={form.email} onChange={e => set('email', e.target.value)} error={errors.email} placeholder="patient@example.com" />
        </Field>
        <Field label="Password" required error={errors.password} help="Initial password — the patient can change it later">
          <TextInput type="password" value={form.password} onChange={e => set('password', e.target.value)} error={errors.password} placeholder="Min. 8 characters" />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <TextInput type="tel" icon="phone" value={form.phone} onChange={e => set('phone', e.target.value)} error={errors.phone} placeholder="+63 917 000 0000" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Gender">
            <SelectInput value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </SelectInput>
          </Field>
          <Field label="Date of birth">
            <TextInput type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export { PatientFormModal };
