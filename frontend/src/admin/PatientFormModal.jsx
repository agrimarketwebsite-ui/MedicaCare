// PatientFormModal — add/edit patient (Phase 6, admin registry).
// Props: open, onClose, initial? (patient row — kapag may laman, edit mode),
// onSaved(savedPatient).
import { useEffect, useState } from 'react';
import { Field, Modal, SelectInput, TextArea, TextInput, useStore } from '../shared/components.jsx';
import { createAdminPatient, updateAdminPatient, ApiError } from '../shared/api.js';

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const GENDERS = ['', 'male', 'female', 'other'];

const EMPTY = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  gender: '',
  date_of_birth: '',
  blood_type: '',
  allergies: '',
  address: '',
  emergency_contact: '',
};

function PatientFormModal({ open, onClose, initial, onSaved }) {
  const store = useStore();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setForm(initial
      ? { ...EMPTY, ...initial, password: '', date_of_birth: (initial.date_of_birth || '').slice(0, 10) }
      : EMPTY);
    setError('');
    setSaving(false);
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const doSave = async () => {
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!editing && !form.password) { setError('Set an initial password for the new patient.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        blood_type: form.blood_type || null,
        allergies: form.allergies.trim() || null,
        address: form.address.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
      };
      if (!editing) body.password = form.password;
      const saved = editing
        ? await updateAdminPatient(initial.id, body)
        : await createAdminPatient(body);
      store.pushToast({
        kind: 'success',
        title: editing ? 'Patient updated' : 'Patient added',
        message: `${saved.full_name} has been ${editing ? 'updated' : 'added to the registry'}.`,
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the patient. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit patient' : 'Add patient'}
      subtitle={editing ? `Editing ${initial?.full_name || ''}` : 'Register a new patient in the directory.'}
      icon="user-plus"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={doSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add patient'}
          </button>
        </>
      }
    >
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Full name" required>
          <TextInput value={form.full_name} onChange={set('full_name')} placeholder="Juan Dela Cruz" maxLength={120} />
        </Field>
        <Field label="Email" required>
          <TextInput type="email" value={form.email} onChange={set('email')} placeholder="patient@example.com" maxLength={160} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={set('phone')} placeholder="+63 900 000 0000" maxLength={20} />
        </Field>
        {!editing && (
          <Field label="Password" required help="Initial password — the patient can change it later.">
            <TextInput type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 chars, letter + number" />
          </Field>
        )}
        <Field label="Gender">
          <SelectInput value={form.gender} onChange={set('gender')}>
            <option value="">—</option>
            {GENDERS.filter(Boolean).map(g => <option key={g} value={g}>{g}</option>)}
          </SelectInput>
        </Field>
        <Field label="Date of birth">
          <TextInput type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
        </Field>
        <Field label="Blood type">
          <SelectInput value={form.blood_type} onChange={set('blood_type')}>
            {BLOOD_TYPES.map(b => <option key={b} value={b}>{b || '—'}</option>)}
          </SelectInput>
        </Field>
        <Field label="Allergies">
          <TextInput value={form.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" maxLength={255} />
        </Field>
        <Field label="Address">
          <TextArea value={form.address} onChange={set('address')} rows={2} placeholder="Street, barangay, city" maxLength={500} />
        </Field>
        <Field label="Emergency contact">
          <TextInput value={form.emergency_contact} onChange={set('emergency_contact')} placeholder="Name + phone number" maxLength={255} />
        </Field>
      </div>
    </Modal>
  );
}

export { PatientFormModal };
