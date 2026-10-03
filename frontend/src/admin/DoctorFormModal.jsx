// DoctorFormModal — add/edit doctor + portal access (restored prototype UI,
// real API). Props: open, onClose, initial? (doctor row — edit mode),
// onSaved(savedDoctor).
//
// Portal access matches the prototype's intent: the email/password collected
// in this form grant access as part of saving (Add, or Edit without an
// account). Password RESET is server-generated (the API mints the temporary
// password), so the Active block offers "Generate new password" instead of
// the prototype's typed-password field. The weekly day picker syncs to the
// availability API on save (new days get 09:00–17:00; existing entries keep
// their times).
import { useEffect, useRef, useState } from 'react';
import {
  DoctorAvatar, Field, Icon, Modal, SelectInput, TextInput, useStore,
} from '../shared/components.jsx';
import { randomInt } from '../shared/data.js';
import {
  apiOptional, createAdminDoctor, createAdminDoctorAvailability,
  deleteAdminDoctorAvailability, getAdminDoctorAvailability,
  grantDoctorAccess, resetDoctorPassword, revokeDoctorAccess,
  updateAdminDoctor, ApiError,
} from '../shared/api.js';
import { focusFirstError } from './helpers.js';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

function DoctorFormModal({ open, onClose, initial, onSaved }) {
  const isEdit = !!initial;
  const store = useStore();
  const [form, setForm] = useState({
    name: '', specialty_id: '', status: 'available', room: '',
    exp: '', fee: '',
  });
  const [specialties, setSpecialties] = useState([]);
  const [errors, setErrors] = useState({});
  const [avail, setAvail] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  // Portal access — admin-issued credentials the doctor signs in with at the
  // Doctor portal. On Add (or Edit without an account) both fields together
  // grant access as part of saving; on Edit with an account, access is
  // already active (reset generates a server-side temporary password).
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPw, setPortalPw] = useState('');
  const [portalErrors, setPortalErrors] = useState({});
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalInfo, setPortalInfo] = useState(null);
  const [tempPw, setTempPw] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiOptional('/doctors/specialties', { auth: false }).then((d) => {
      if (cancelled) return;
      const list = (d && d.specialties) || [];
      setSpecialties(list);
      // Prototype defaults the specialty (Cardiology — first alphabetically)
      if (!initial && list.length > 0) {
        setForm(f => (f.specialty_id ? f : { ...f, specialty_id: list[0].id }));
      }
    });
    if (initial) {
      setForm({
        name: initial.full_name || '',
        specialty_id: initial.specialty_id || '',
        status: initial.status || 'available',
        room: initial.room || '',
        exp: initial.years_of_experience ?? '',
        fee: initial.consultation_fee ?? '',
      });
      setPhoto(initial.photo_url || '');
      setPortalInfo(initial.portal_email ? { email: initial.portal_email } : null);
      // Weekly availability for the day picker (weekday 1–7 ISO → day names)
      getAdminDoctorAvailability(initial.id)
        .then((list) => {
          if (cancelled) return;
          const days = [...new Set((list || []).map(e => Number(e.weekday)))]
            .filter(w => Number.isInteger(w) && w >= 1 && w <= 7)
            .sort((a, b) => a - b)
            .map(w => DAY_SHORT[w - 1]);
          if (days.length) setAvail(days);
        })
        .catch(() => {});
    } else {
      setForm({ name: '', specialty_id: '', status: 'available', room: '', exp: '', fee: '' });
      setAvail(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      setPhoto('');
      setPortalInfo(null);
    }
    setPhotoError('');
    setErrors({});
    setPortalEmail('');
    setPortalPw('');
    setPortalErrors({});
    setTempPw('');
    setSaving(false);
    return () => { cancelled = true; };
  }, [open, initial]);

  const onPhotoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
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

  // Unambiguous charset (no I/l/1/O/0) so a generated password is easy to
  // re-type when the admin shares it with the doctor
  const generatePw = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    // randomInt rejection-samples, so every character of the password is
    // equally likely (a plain `n % chars.length` would skew the tail chars)
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars[randomInt(chars.length)];
    setPortalPw(pw);
    if (portalErrors.password) setPortalErrors(pe => ({ ...pe, password: null }));
  };

  const toggleDay = (day) => setAvail(av => av.includes(day) ? av.filter(d => d !== day) : [...av, day]);

  // Sync the prototype's day picker to the availability API: drop entries for
  // deselected days, create 09:00–17:00 entries for newly selected days.
  // Entries for days that stay selected keep their existing times.
  const syncAvailability = async (doctorId) => {
    const selected = new Set(avail.map(d => DAY_SHORT.indexOf(d) + 1));
    const existing = await getAdminDoctorAvailability(doctorId).catch(() => []);
    const byDay = new Map();
    existing.forEach(e => {
      const w = Number(e.weekday);
      if (!Number.isInteger(w) || w < 1 || w > 7) return;
      if (!byDay.has(w)) byDay.set(w, []);
      byDay.get(w).push(e);
    });
    for (const [w, entries] of byDay) {
      if (!selected.has(w)) {
        for (const en of entries) await deleteAdminDoctorAvailability(doctorId, en.id);
      }
    }
    for (const w of selected) {
      if (!byDay.has(w)) {
        await createAdminDoctorAvailability(doctorId, {
          weekday: w, start_time: DEFAULT_START, end_time: DEFAULT_END,
        });
      }
    }
  };

  const doSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Doctor name is required';
    if (!form.specialty_id) e.specialty_id = 'Specialty is required';
    if (!form.room.trim()) e.room = 'Room / clinic is required';
    if (!form.exp) e.exp = 'Years of experience required';
    if (!form.fee) e.fee = 'Consultation fee required';
    if (!avail.length) e.avail = 'Select at least one available day';
    // Portal access validation — optional: blank fields mean "no account yet"
    // (it can be granted later from Edit).
    const pe = {};
    const granting = !isEdit || !portalInfo;
    if (granting) {
      const email = portalEmail.trim();
      if (email || portalPw) {
        if (!email) pe.email = 'Portal email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) pe.email = 'Enter a valid email address';
        if (!portalPw) pe.password = 'Password is required';
        else if (portalPw.length < 8) pe.password = 'Use at least 8 characters';
      }
    }
    setPortalErrors(pe);
    setErrors(e);
    if (Object.keys(e).length || Object.keys(pe).length) { focusFirstError(); return; }

    setSaving(true);
    try {
      // photo_url only accepts real URLs (≤500 chars) — an uploaded data URL
      // can't be persisted by the API, so it stays a preview in this form.
      const photoIsUrl = photo && !String(photo).startsWith('data:');
      const body = {
        full_name: form.name.trim(),
        specialty_id: form.specialty_id,
        status: form.status,
        room: form.room.trim(),
        years_of_experience: Number(form.exp),
        consultation_fee: Number(form.fee),
        ...(photoIsUrl ? { photo_url: photo } : (!photo && isEdit ? { photo_url: null } : {})),
      };
      const saved = isEdit
        ? await updateAdminDoctor(initial.id, body)
        : await createAdminDoctor(body);
      try {
        await syncAvailability(saved.id);
      } catch (avErr) {
        store.pushToast({ kind: 'warning', title: 'Availability not saved', msg: 'The doctor was saved, but the weekly availability could not be updated.' });
      }
      // Add mode: the doctor id only exists after creation — grant the portal
      // account now so the email/password fields are functional. Same on Edit
      // without an account (the prototype grants access as part of saving).
      if (granting && portalEmail.trim() && portalPw) {
        try {
          await grantDoctorAccess(saved.id, {
            email: portalEmail.trim().toLowerCase(),
            password: portalPw,
          });
          store.pushToast({
            kind: 'success',
            title: 'Portal access granted',
            msg: `${saved.full_name} can now sign in at the Doctor portal as ${portalEmail.trim().toLowerCase()}.`,
          });
        } catch (grantErr) {
          store.pushToast({
            kind: 'error',
            title: 'Portal access not granted',
            msg: grantErr instanceof ApiError ? grantErr.message : 'Could not grant portal access. You can grant it later from Edit.',
          });
        }
      }
      store.pushToast({
        kind: 'success',
        title: isEdit ? 'Doctor updated' : 'Doctor added',
        msg: isEdit
          ? `${saved.full_name}'s profile has been updated.`
          : `${saved.full_name} has been added to your directory.`,
      });
      onSaved && onSaved(saved);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Could not save doctor.' });
    } finally {
      setSaving(false);
    }
  };

  const doResetPortal = async () => {
    setPortalBusy(true);
    try {
      const result = await resetDoctorPassword(initial.id);
      setTempPw(result.password || '');
      store.pushToast({ kind: 'success', title: 'Password reset', msg: 'A new temporary password was generated — share it with the doctor.' });
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
      store.pushToast({ kind: 'success', title: 'Portal access revoked', msg: 'The doctor can no longer sign in at the Doctor portal.' });
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
      subtitle={isEdit ? 'Update the doctor\'s profile, availability, and portal access.' : 'Create a new doctor profile, schedule, and portal access.'}
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
            <TextInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={errors.name} placeholder="Dr. Juan Dela Cruz" />
          </Field>
          <Field label="Specialty" required error={errors.specialty_id}>
            <SelectInput value={form.specialty_id} onChange={e => setForm(f => ({ ...f, specialty_id: e.target.value }))} error={errors.specialty_id}>
              {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="available">Available</option>
              <option value="busy">Busy today</option>
              <option value="on-leave">On leave</option>
            </SelectInput>
          </Field>
          <Field label="Room / clinic" required error={errors.room}>
            <TextInput value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} error={errors.room} placeholder="e.g., Cardio Wing • Rm 402" />
          </Field>
          <Field label="Years of experience" required error={errors.exp}>
            <TextInput type="number" value={form.exp} onChange={e => setForm(f => ({ ...f, exp: e.target.value }))} error={errors.exp} placeholder="10" />
          </Field>
          <Field label="Consultation fee (₱)" required error={errors.fee}>
            <TextInput type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} error={errors.fee} placeholder="1500" />
          </Field>
        </div>
        <Field label="Weekly availability" error={errors.avail} help={!errors.avail && 'Days the doctor is available for consultations'}>
          <div className="chip-group">
            {DAY_SHORT.map(day => (
              <button key={day} type="button" className={'chip' + (avail.includes(day) ? ' on' : '')} onClick={() => toggleDay(day)}>
                {day}
              </button>
            ))}
          </div>
        </Field>

        {/* Portal access — admin-issued credentials for the Doctor portal.
            The portal itself is login-only: doctors never self-register. */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Icon name="key-round" size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Doctor portal access</span>
          </div>
          <p className="t-muted" style={{ fontSize: 12, margin: '0 0 10px', lineHeight: 1.5 }}>
            {isEdit && portalInfo
              ? 'Active. The doctor signs in at the Doctor portal with the email below. Reset the password here if needed.'
              : 'Create the login the doctor will use at the Doctor portal. Leave both fields blank to add the profile without portal access. It can be granted later from Edit.'}
          </p>
          {portalErrors.form && <div className="form-error" style={{ margin: '0 0 10px' }}><Icon name="alert-circle" size={14} /> {portalErrors.form}</div>}
          {isEdit && portalInfo ? (
            <div className="stack md">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Portal email" help="Issued with the account and cannot be changed here.">
                  <TextInput value={portalInfo.email} disabled />
                </Field>
                <Field label="New password" help="Generates a temporary password — share it with the doctor securely.">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={doResetPortal} disabled={portalBusy}>
                      {portalBusy ? 'Working…' : 'Generate new password'}
                    </button>
                  </div>
                  {tempPw && (
                    <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-muted)', borderRadius: 8, fontSize: 12.5 }}>
                      Temporary password — give this to the doctor: <code>{tempPw}</code>
                    </div>
                  )}
                </Field>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-danger-outline sm" onClick={doRevokePortal} disabled={portalBusy}>
                  <Icon name="shield-off" size={13} /> Revoke portal access
                </button>
                <span className="t-muted" style={{ fontSize: 11.5 }}>Removes the doctor's login. It can be granted again later.</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Portal email" error={portalErrors.email} help={!portalErrors.email && 'Used to sign in at the Doctor portal.'}>
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
          )}
        </div>
      </div>
    </Modal>
  );
}

export { DoctorFormModal };
