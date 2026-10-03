// PatientFormModal — add patient (restored prototype UI, real API).
// Props: open, onClose, onSaved(). Add-only; personal info is owned by the
// patient via their Profile page.
import { useEffect, useRef, useState } from 'react';
import { Field, Icon, Modal, PatientAvatar, SelectInput, TextInput, useStore } from '../shared/components.jsx';
import { createAdminPatient, ApiError } from '../shared/api.js';
import { focusFirstError } from './helpers.js';

function PatientFormModal({ open, onClose, onSaved }) {
  const store = useStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', gender: 'male', dob: '', password: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', phone: '', gender: 'male', dob: '', password: '' });
      setErrors({});
      setSaving(false);
      setPhoto('');
      setPhotoError('');
    }
  }, [open]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };

  const onPhotoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file (JPG or PNG).');
      return;
    }
    if (file.size > 1024 * 1024) {
      setPhotoError('Image is too large. Please choose one under 1 MB.');
      return;
    }
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
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
      store.pushToast({ kind: 'success', title: 'Patient added', message: `${form.name.trim()} has been added to the registry.` });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {photo
            ? <img src={photo} alt="Patient" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
            : <PatientAvatar person={{ name: form.name }} size={64} />}
          <div>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoChange} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary sm" onClick={() => photoInputRef.current && photoInputRef.current.click()}>
                <Icon name="upload" size={14} /> Upload photo
              </button>
              {photo && <button type="button" className="btn btn-ghost sm" onClick={() => setPhoto('')}>Remove</button>}
            </div>
            <div className="t-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Optional. Defaults to a portrait photo. JPG/PNG up to 1 MB.
            </div>
            {photoError && <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{photoError}</div>}
          </div>
        </div>
        <Field label="Full name" required error={errors.name}>
          <TextInput value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} placeholder="e.g., Juan dela Cruz" />
        </Field>
        <Field label="Email" required error={errors.email} help="Used for the patient's portal login">
          <TextInput type="email" icon="mail" value={form.email} onChange={e => set('email', e.target.value)} error={errors.email} placeholder="patient@example.com" />
        </Field>
        <Field label="Password" required error={errors.password} help="Initial password — the patient can change it later">
          <TextInput type="password" value={form.password} onChange={e => set('password', e.target.value)} error={errors.password} placeholder="Min. 8 characters" />
        </Field>
        <Field label="Phone" error={errors.phone}>
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
