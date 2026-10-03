// DoctorFormModal — add/edit doctor + portal access (restored prototype UI,
// real API). Props: open, onClose, initial? (doctor row — edit mode),
// onSaved(savedDoctor).
import { useEffect, useRef, useState } from 'react';
import {
  DoctorAvatar, Field, Icon, Modal, SelectInput, TextInput, TextArea, useStore,
} from '../shared/components.jsx';
import {
  createAdminDoctor, updateAdminDoctor, grantDoctorAccess,
  resetDoctorPassword, revokeDoctorAccess, ApiError,
} from '../shared/api.js';
import { apiOptional } from '../shared/api.js';
import { focusFirstError } from './helpers.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DoctorFormModal({ open, onClose, initial, onSaved }) {
  const store = useStore();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: '', specialty_id: '', status: 'available', room: '',
    exp: '', fee: '', gender: '', bio: '',
  });
  const [specialties, setSpecialties] = useState([]);
  const [avail, setAvail] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Portal access
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPw, setPortalPw] = useState('');
  const [portalErrors, setPortalErrors] = useState({});
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalInfo, setPortalInfo] = useState(null);
  const [showRevoke, setShowRevoke] = useState(false);
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    apiOptional('/doctors/specialties', { auth: false }).then((d) => {
      setSpecialties(d.specialties || []);
    });
    if (initial) {
      setForm({
        name: initial.full_name || '',
        specialty_id: initial.specialty_id || '',
        status: initial.status || 'available',
        room: initial.room || '',
        exp: initial.years_of_experience ?? '',
        fee: initial.consultation_fee ?? '',
        gender: initial.gender || '',
        bio: initial.bio || '',
      });
      setPortalInfo(initial.doctor_accounts?.email || initial.portal_email
        ? { email: initial.doctor_accounts?.email || initial.portal_email }
        : null);
    } else {
      setForm({ name: '', specialty_id: '', status: 'available', room: '', exp: '', fee: '', gender: '', bio: '' });
      setPortalInfo(null);
    }
    setAvail(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setErrors({});
    setPortalEmail('');
    setPortalPw('');
    setPortalErrors({});
    setShowRevoke(false);
    setPhoto(initial?.photo_url || '');
    setPhotoError('');
  }, [open, initial]);

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

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(x => ({ ...x, [k]: null }));
  };
  const toggleDay = (day) => setAvail(av => av.includes(day) ? av.filter(d => d !== day) : [...av, day]);

  const generatePw = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pw = '';
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 10; i++) pw += chars[arr[i] % chars.length];
    setPortalPw(pw);
    if (portalErrors.password) setPortalErrors(pe => ({ ...pe, password: null }));
  };

  const doSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Doctor name is required';
    if (!form.specialty_id) e.specialty_id = 'Specialty is required';
    if (!form.room.trim()) e.room = 'Room / clinic is required';
    if (form.exp === '' || form.exp == null) e.exp = 'Years of experience required';
    if (form.fee === '' || form.fee == null) e.fee = 'Consultation fee required';
    setErrors(e);
    if (Object.keys(e).length) { focusFirstError(); return; }

    setSaving(true);
    try {
      const body = {
        full_name: form.name.trim(),
        specialty_id: form.specialty_id,
        status: form.status,
        room: form.room.trim(),
        years_of_experience: Number(form.exp),
        consultation_fee: Number(form.fee),
        gender: form.gender || null,
        bio: form.bio.trim() || null,
        // photo_url only accepts URLs (max 500 chars); base64 uploads stay local-only
        ...(photo && !photo.startsWith('data:') ? { photo_url: photo } : {}),
      };
      const saved = isEdit
        ? await updateAdminDoctor(initial.id, body)
        : await createAdminDoctor(body);
      store.pushToast({
        kind: 'success',
        title: isEdit ? 'Doctor updated' : 'Doctor added',
        message: `${saved.full_name} has been ${isEdit ? 'updated' : 'added to the directory'}.`,
      });
      onSaved && onSaved(saved);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Could not save doctor.' });
    } finally {
      setSaving(false);
    }
  };

  const doGrantPortal = async () => {
    const pe = {};
    if (!portalEmail.trim()) pe.email = 'Portal email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(portalEmail)) pe.email = 'Enter a valid email address';
    if (!portalPw) pe.password = 'Password is required';
    else if (portalPw.length < 8) pe.password = 'Use at least 8 characters';
    setPortalErrors(pe);
    if (Object.keys(pe).length) return;

    setPortalBusy(true);
    try {
      const targetId = isEdit ? initial.id : null;
      // For add mode, we need the doctor ID first — save the doctor, then grant
      let doctorId = targetId;
      if (!doctorId) {
        // Save doctor first (without closing), then grant portal
        await doSave();
        return; // doSave closes the modal; portal must be granted from Edit
      }
      await grantDoctorAccess(doctorId, { email: portalEmail.trim().toLowerCase(), password: portalPw });
      setPortalInfo({ email: portalEmail.trim().toLowerCase() });
      setPortalEmail('');
      setPortalPw('');
      store.pushToast({ kind: 'success', title: 'Portal access granted', message: 'The doctor can now sign in at the Doctor portal.' });
    } catch (err) {
      setPortalErrors({ form: err instanceof ApiError ? err.message : 'Could not grant portal access.' });
    } finally {
      setPortalBusy(false);
    }
  };

  const doResetPortal = async () => {
    setPortalBusy(true);
    try {
      const result = await resetDoctorPassword(initial.id);
      setPortalPw(result.password || '');
      store.pushToast({ kind: 'success', title: 'Password reset', message: 'A new temporary password was generated — share it with the doctor.' });
    } catch (err) {
      setPortalErrors({ form: err instanceof ApiError ? err.message : 'Could not reset password.' });
    } finally {
      setPortalBusy(false);
    }
  };

  const doRevokePortal = async () => {
    setPortalBusy(true);
    try {
      await revokeDoctorAccess(initial.id);
      setPortalInfo(null);
      setShowRevoke(false);
      store.pushToast({ kind: 'success', title: 'Portal access revoked', message: 'The doctor can no longer sign in at the Doctor portal.' });
    } catch (err) {
      setPortalErrors({ form: err instanceof ApiError ? err.message : 'Could not revoke portal access.' });
    } finally {
      setPortalBusy(false);
    }
  };

  return (
    <Modal
      open={open} onClose={onClose} size="lg"
      title={isEdit ? 'Edit doctor' : 'Add new doctor'}
      subtitle={isEdit ? `Editing ${initial.full_name}` : 'Create a new doctor profile, schedule, and portal access.'}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={doSave} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add doctor')}</button>
      </>}
    >
      <div className="stack md">
        {errors.form && <div className="form-error"><Icon name="alert-circle" size={14} /> {errors.form}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {photo
            ? <img src={photo} alt="Doctor" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
            : <DoctorAvatar doctor={{ name: form.name }} size={64} />}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Full name" required error={errors.name}>
            <TextInput value={form.name} onChange={set('name')} error={errors.name} placeholder="Dr. Juan Dela Cruz" />
          </Field>
          <Field label="Specialty" required error={errors.specialty_id}>
            <SelectInput value={form.specialty_id} onChange={set('specialty_id')} error={errors.specialty_id}>
              <option value="">Select specialty…</option>
              {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={set('status')}>
              <option value="available">Available</option>
              <option value="busy">Busy today</option>
              <option value="on-leave">On leave</option>
            </SelectInput>
          </Field>
          <Field label="Room / clinic" required error={errors.room}>
            <TextInput value={form.room} onChange={set('room')} error={errors.room} placeholder="e.g., Cardio Wing • Rm 402" />
          </Field>
          <Field label="Years of experience" required error={errors.exp}>
            <TextInput type="number" value={form.exp} onChange={set('exp')} error={errors.exp} placeholder="10" />
          </Field>
          <Field label="Consultation fee (₱)" required error={errors.fee}>
            <TextInput type="number" value={form.fee} onChange={set('fee')} error={errors.fee} placeholder="1500" />
          </Field>
          <Field label="Gender">
            <SelectInput value={form.gender} onChange={set('gender')}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </SelectInput>
          </Field>
          <Field label="Bio">
            <TextArea value={form.bio} onChange={set('bio')} rows={2} placeholder="Short professional bio…" />
          </Field>
        </div>
        <Field label="Weekly availability" help="Days the doctor is available for consultations">
          <div className="chip-group">
            {DAYS.map(day => (
              <button key={day} type="button" className={'chip' + (avail.includes(day) ? ' on' : '')} onClick={() => toggleDay(day)}>
                {day}
              </button>
            ))}
          </div>
        </Field>

        {/* Portal access — admin-issued credentials for the Doctor portal. */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Icon name="key-round" size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Doctor portal access</span>
          </div>
          {portalErrors.form && <div className="form-error" style={{ margin: '8px 0' }}><Icon name="alert-circle" size={14} /> {portalErrors.form}</div>}
          {isEdit && portalInfo ? (
            <div className="stack md">
              <p className="t-muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Active. The doctor signs in at the Doctor portal as <strong>{portalInfo.email}</strong>.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary sm" onClick={doResetPortal} disabled={portalBusy}>
                  {portalBusy ? 'Working…' : 'Generate new password'}
                </button>
                <button type="button" className="btn btn-danger-outline sm" onClick={() => setShowRevoke(true)} disabled={portalBusy}>
                  <Icon name="shield-off" size={13} /> Revoke portal access
                </button>
              </div>
              {portalPw && (
                <div style={{ padding: 10, background: 'var(--bg-muted)', borderRadius: 8, fontSize: 12.5 }}>
                  Temporary password — give this to the doctor: <code>{portalPw}</code>
                </div>
              )}
              {showRevoke && (
                <div style={{ padding: 12, border: '1px solid var(--error)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Revoke portal access?</div>
                  <div className="t-muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                    This will immediately prevent {initial.full_name} from logging in to the doctor portal. Their directory profile stays in place.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost sm" onClick={() => setShowRevoke(false)}>Cancel</button>
                    <button className="btn btn-danger sm" onClick={doRevokePortal} disabled={portalBusy}>Revoke access</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="t-muted" style={{ fontSize: 12, margin: '0 0 10px', lineHeight: 1.5 }}>
                {isEdit
                  ? 'This doctor has no portal account yet — grant one below.'
                  : 'Create the login the doctor will use at the Doctor portal. Leave both fields blank to add the profile without portal access. It can be granted later from Edit.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Portal email" error={portalErrors.email}>
                  <TextInput type="email" icon="mail" placeholder="doctor@medicacare.ph" value={portalEmail} error={portalErrors.email}
                    onChange={e => { setPortalEmail(e.target.value); if (portalErrors.email) setPortalErrors(pe => ({ ...pe, email: null })); }} />
                </Field>
                <Field label="Password" error={portalErrors.password} help={!portalErrors.password && 'Minimum 8 characters. Share it with the doctor securely.'}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <TextInput type="text" style={{ flex: 1 }} value={portalPw} error={portalErrors.password}
                      onChange={e => { setPortalPw(e.target.value); if (portalErrors.password) setPortalErrors(pe => ({ ...pe, password: null })); }}
                      placeholder="Min 8 characters" />
                    <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={generatePw}>Generate</button>
                  </div>
                </Field>
              </div>
              {isEdit && (
                <button type="button" className="btn btn-secondary sm" onClick={doGrantPortal} disabled={portalBusy} style={{ marginTop: 8 }}>
                  {portalBusy ? 'Working…' : 'Grant portal access'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export { DoctorFormModal };
