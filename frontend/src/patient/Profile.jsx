// Profile — patient (Phase 4: wired to the backend API)
// GET /api/patients/me on mount (prefill), PUT /api/patients/me on save;
// family members via /api/patients/me/family (list/create/delete); reminder
// toggles PUT on toggle. Password change posts to /api/auth/change-password
// (backend route still needs to be implemented — see api.js).
import { useEffect, useRef, useState } from 'react';
import { AppShell, ConfirmModal, EmptyState, ErrorState, Field, Icon, PageHeader, PageSpinner, PatientAvatar, PwField, SelectInput, TextInput, useStore } from '../shared/components.jsx';
import { changePassword, createFamily, deleteFamily, listFamily, updateProfile } from '../shared/api.js';
import { focusFirstError } from './helpers.js';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function toForm(p) {
  return {
    full_name: p.full_name || '',
    phone: p.phone || '',
    gender: p.gender || '',
    date_of_birth: p.date_of_birth || '',
    blood_type: p.blood_type || '',
    address: p.address || '',
    emergency_contact: p.emergency_contact || '',
    allergies: p.allergies || '',
  };
}

function Profile() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(toForm({}));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const photoInputRef = useRef(null);
  // Family members (proxy booking) — inline add form, same as the prototype
  const [famForm, setFamForm] = useState({ name: '', relation: 'Spouse' });
  const [famErrors, setFamErrors] = useState({});
  const [confirmRemoveFam, setConfirmRemoveFam] = useState(null);
  const [removingFam, setRemovingFam] = useState(false);
  // Reminder toggles (PUT on toggle)
  const [toggling, setToggling] = useState(null); // 'email_reminders' | 'portal_notifications' | null
  // Photo — client-side preview (localStorage); the API photo_url is the
  // fallback when there is no local photo
  const [photo, setPhoto] = useState(() => {
    try { return localStorage.getItem('nmc.patientPhoto') || ''; } catch { return ''; }
  });

  // Load profile + family on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await store.refreshProfile();
        if (cancelled) return;
        if (p) setForm(toForm(p));
        else setLoadError('Could not load the profile. Please try again.');
        const fam = await listFamily().catch(() => []);
        if (!cancelled) store.setFamilyMembers(fam);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not load the profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = store.profile;
  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };
  const updatePw = (k, v) => { setPw(p => ({ ...p, [k]: v })); if (pwErrors[k]) setPwErrors(e => ({ ...e, [k]: null })); };

  const onPhotoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      store.pushToast({ kind: 'error', title: 'Invalid file', msg: 'Please choose an image file.' });
      return;
    }
    if (file.size > 1024 * 1024) {
      store.pushToast({ kind: 'error', title: 'Image too large', msg: 'Please choose an image under 1 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result);
      try { localStorage.setItem('nmc.patientPhoto', reader.result); } catch { /* storage full — keep in-session preview only */ }
      store.pushToast({ title: 'Photo updated', msg: 'Your profile photo has been changed.' });
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    setErrors(e);
    if (Object.keys(e).length) { focusFirstError(); return; }
    setSaving(true);
    try {
      await updateProfile({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        blood_type: form.blood_type || null,
        allergies: form.allergies.trim() || null,
        address: form.address.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
      });
      await store.refreshProfile();
      store.pushToast({ title: 'Profile updated', msg: 'Your changes have been saved.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not save', msg: err.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const savePw = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!pw.current) e.current = 'Enter your current password';
    if (!pw.next) e.next = 'Enter a new password';
    else if (pw.next.length < 8) e.next = 'Use at least 8 characters';
    if (!pw.confirm) e.confirm = 'Please confirm your new password';
    else if (pw.confirm !== pw.next) e.confirm = 'Passwords do not match';
    setPwErrors(e);
    if (Object.keys(e).length) { focusFirstError(); return; }
    setSavingPw(true);
    try {
      await changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      setPwErrors({});
      store.pushToast({ title: 'Password changed', msg: 'Your new password is now active.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not change password', msg: err.message || 'Please try again.' });
    } finally {
      setSavingPw(false);
    }
  };

  const toggleReminder = async (key) => {
    if (!me || toggling) return;
    setToggling(key);
    try {
      await updateProfile({ [key]: !me[key] });
      await store.refreshProfile();
      store.pushToast({ title: 'Preference saved', msg: `${key === 'email_reminders' ? 'Email reminders' : 'Portal notifications'} ${!me[key] ? 'on' : 'off'}.` });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not save', msg: err.message || 'Please try again.' });
    } finally {
      setToggling(null);
    }
  };

  // ---- Family members ----
  const updateFam = (k, v) => { setFamForm(f => ({ ...f, [k]: v })); if (famErrors[k]) setFamErrors(e => ({ ...e, [k]: null })); };
  const addFam = async (evt) => {
    evt.preventDefault();
    const errs = {};
    if (!famForm.name.trim()) errs.name = 'Name is required';
    setFamErrors(errs);
    if (Object.keys(errs).length) { focusFirstError(); return; }
    try {
      const created = await createFamily({ full_name: famForm.name.trim(), relation: famForm.relation });
      store.setFamilyMembers([...(store.familyMembers || []), created]);
      setFamForm({ name: '', relation: famForm.relation });
      store.pushToast({ title: 'Family member added', msg: 'You can now book appointments on their behalf.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not add family member', msg: err.message || 'Please try again.' });
    }
  };
  const doRemoveFam = async () => {
    setRemovingFam(true);
    try {
      await deleteFamily(confirmRemoveFam.id);
      store.setFamilyMembers((store.familyMembers || []).filter(f => f.id !== confirmRemoveFam.id));
      store.pushToast({ title: 'Family member removed', msg: `${confirmRemoveFam.full_name} has been removed.` });
      setConfirmRemoveFam(null);
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not remove', msg: err.message || 'Please try again.' });
    } finally {
      setRemovingFam(false);
    }
  };

  if (loading) {
    return (
      <AppShell current="profile">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

  if (loadError || !me) {
    return (
      <AppShell current="profile">
        <div className="page">
          <PageHeader title="Profile" breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Profile' }]} />
          <div className="card"><ErrorState title="Couldn't load the profile" message={loadError || 'Profile not found.'} onRetry={() => window.location.reload()} /></div>
        </div>
      </AppShell>
    );
  }

  const joinedLabel = me.created_at
    ? new Date(me.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';
  const avatarPerson = { name: me.full_name, photo: photo || me.photo_url || '' };

  return (
    <AppShell current="profile">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader title="Profile" subtitle="Manage your personal information and password."
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Profile' }]} />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body appt-head">
            {avatarPerson.photo
              ? <img src={avatarPerson.photo} alt="Profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
              : <PatientAvatar person={avatarPerson} size={72} />}
            <div className="appt-head-info">
              <div style={{ fontSize: 18, fontWeight: 600 }}>{me.full_name}</div>
              <div className="t-muted">Patient{joinedLabel ? ` · Member since ${joinedLabel}` : ''}</div>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoChange} />
            <button className="btn btn-secondary profile-photo-btn" onClick={() => photoInputRef.current && photoInputRef.current.click()}>
              <Icon name="upload" size={14} /> Change photo
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Personal information</h2></div>
          <form onSubmit={saveProfile} noValidate>
            <div className="card-body">
              <div className="profile-grid">
                <Field label="Full name" required error={errors.full_name}>
                  <TextInput value={form.full_name} onChange={e => update('full_name', e.target.value)} error={errors.full_name} />
                </Field>
                <Field label="Email address" help="Contact the clinic to change your email address.">
                  <TextInput type="email" value={me.email || ''} disabled icon="mail" />
                </Field>
                <Field label="Phone number" required error={errors.phone}>
                  <TextInput type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} error={errors.phone} icon="phone" />
                </Field>
                <Field label="Date of birth">
                  <TextInput type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} />
                </Field>
                <Field label="Gender">
                  <SelectInput value={form.gender} onChange={e => update('gender', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Prefer not to say</option>
                  </SelectInput>
                </Field>
                <Field label="Blood type">
                  <SelectInput value={form.blood_type} onChange={e => update('blood_type', e.target.value)}>
                    <option value="">Select…</option>
                    {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Home address">
                  <TextInput value={form.address} onChange={e => update('address', e.target.value)} />
                </Field>
                <Field label="Emergency contact">
                  <TextInput value={form.emergency_contact} onChange={e => update('emergency_contact', e.target.value)} />
                </Field>
                <Field label="Known allergies" help="Comma-separated. Write 'None' if not applicable.">
                  <TextInput value={form.allergies} onChange={e => update('allergies', e.target.value)} />
                </Field>
              </div>
            </div>
            <div className="card-footer">
              <button type="button" className="btn btn-ghost" onClick={() => { setForm(toForm(me)); setErrors({}); }}>Reset</button>
              <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}>Save changes</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Change password</h2></div>
          <form onSubmit={savePw}>
            <div className="card-body">
              <div className="pw-grid">
                  <PwField label="Current password" required error={pwErrors.current} autoComplete="current-password"
                    value={pw.current} onChange={e => updatePw('current', e.target.value)} />
                  <PwField label="New password" required error={pwErrors.next} help={!pwErrors.next && 'At least 8 characters'}
                    autoComplete="new-password" value={pw.next} onChange={e => updatePw('next', e.target.value)} />
                  <PwField label="Confirm new password" required error={pwErrors.confirm} autoComplete="new-password"
                    value={pw.confirm} onChange={e => updatePw('confirm', e.target.value)} />
              </div>
            </div>
            <div className="card-footer">
              <button type="submit" className={`btn btn-primary ${savingPw ? 'btn-loading' : ''}`}>Update password</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Family members</h2></div>
          <form onSubmit={addFam}>
            <div className="card-body stack md">
              <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                You can book appointments for the people below — they appear as options in the booking form's "Who is this visit for?" dropdown.
              </p>
              {(store.familyMembers || []).length === 0 ? (
                <EmptyState icon="users-round" title="No family members yet" message="Add one so you can book on their behalf." />
              ) : (store.familyMembers || []).map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{f.full_name}</div>
                    {/* Relation only — the booking form lists members by name + relation */}
                    <div className="t-muted" style={{ fontSize: 12 }}>{f.relation}</div>
                  </div>
                  <button type="button" className="btn-icon" title="Remove" aria-label={`Remove ${f.full_name}`} style={{ color: 'var(--error)' }} onClick={() => setConfirmRemoveFam(f)}>
                    <Icon name="trash-2" size={16} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
                <Field label="Name" error={famErrors.name}>
                  <TextInput value={famForm.name} onChange={e => updateFam('name', e.target.value)} error={famErrors.name} placeholder="e.g., Maria Bautista" />
                </Field>
                <Field label="Relation">
                  <SelectInput value={famForm.relation} onChange={e => updateFam('relation', e.target.value)}>
                    {['Spouse', 'Child', 'Parent', 'Sibling', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                  </SelectInput>
                </Field>
                <div style={{ paddingBottom: 1 }}>
                  <button type="submit" className="btn btn-primary"><Icon name="user-plus" size={14} /> Add</button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="h-section">Notifications &amp; reminders</h2></div>
          <div className="card-body stack lg">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!me.email_reminders}
                disabled={toggling === 'email_reminders'}
                onChange={() => toggleReminder('email_reminders')}
              />
              <span>Email me a reminder the day before my appointment</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!me.portal_notifications}
                disabled={toggling === 'portal_notifications'}
                onChange={() => toggleReminder('portal_notifications')}
              />
              <span>Show status-change notifications in the portal</span>
            </label>
            <p className="t-help" style={{ margin: 0 }}>
              Saved to your account instantly. Clinic-wide reminder settings are managed by staff.
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmRemoveFam}
        onClose={() => setConfirmRemoveFam(null)}
        onConfirm={doRemoveFam}
        loading={removingFam}
        title="Remove family member?"
        message={confirmRemoveFam ? `${confirmRemoveFam.full_name} will be removed. You will no longer be able to book on their behalf.` : ''}
        confirmLabel="Remove"
        kind="danger"
      />
    </AppShell>
  );
}

export { Profile };
