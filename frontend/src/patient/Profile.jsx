// Profile — patient (Phase 4: wired to the backend API)
// GET /api/patients/me on mount (prefill), PUT /api/patients/me on save;
// family members CRUD via /api/patients/me/family; reminder toggles PUT on
// toggle. No localStorage mock data — the database is the source of truth.
import { useEffect, useRef, useState } from 'react';
import { AppShell, ConfirmModal, EmptyState, ErrorState, Field, Icon, Modal, PageHeader, PageSpinner, PatientAvatar, SelectInput, TextInput, useStore } from '../shared/components.jsx';
import { createFamily, deleteFamily, listFamily, updateFamily, updateProfile } from '../shared/api.js';
import { focusFirstError } from './helpers.js';

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];
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
  const [saveMsg, setSaveMsg] = useState(null); // {kind, text}
  // Reminder toggles (PUT on toggle)
  const [toggling, setToggling] = useState(null); // 'email_reminders' | 'portal_notifications' | null
  // Family members
  const [famModal, setFamModal] = useState(null); // null | {mode:'add'} | {mode:'edit', member}
  const [famForm, setFamForm] = useState({ full_name: '', relation: 'Spouse', age: '' });
  const [famErrors, setFamErrors] = useState({});
  const [famSaving, setFamSaving] = useState(false);
  const [confirmRemoveFam, setConfirmRemoveFam] = useState(null);
  const [removingFam, setRemovingFam] = useState(false);
  // Photo — client-side preview only (walang photo-upload endpoint sa
  // contract); ang API photo_url ang fallback kapag walang local photo
  const photoInputRef = useRef(null);
  const [photo, setPhoto] = useState(() => {
    try { return localStorage.getItem('nmc.patientPhoto') || ''; } catch { return ''; }
  });

  // Load profile + family on mount (ang store effect ay nag-hydrate na rin
  // kapag may session; ang tawag dito ay nagsisiguro ng loading/error states)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await store.refreshProfile();
        if (cancelled) return;
        if (p) setForm(toForm(p));
        else setLoadError('Hindi ma-load ang profile. Pakisubukang muli.');
        const fam = await listFamily().catch(() => []);
        if (!cancelled) store.setFamilyMembers(fam);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Hindi ma-load ang profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = store.profile;
  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };

  const onPhotoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
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
      try { localStorage.setItem('nmc.patientPhoto', reader.result); } catch { /* storage full — preview only */ }
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
    setSaveMsg(null);
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
      setSaveMsg({ kind: 'success', text: 'Your changes have been saved.' });
    } catch (err) {
      setSaveMsg({ kind: 'error', text: err.message || 'Hindi na-save ang profile. Pakisubukang muli.' });
    } finally {
      setSaving(false);
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
      store.pushToast({ kind: 'error', title: 'Hindi na-save', msg: err.message || 'Pakisubukang muli.' });
    } finally {
      setToggling(null);
    }
  };

  // ---- Family members ----
  const openAddFam = () => {
    setFamForm({ full_name: '', relation: 'Spouse', age: '' });
    setFamErrors({});
    setFamModal({ mode: 'add' });
  };
  const openEditFam = (member) => {
    setFamForm({ full_name: member.full_name || '', relation: member.relation || 'Other', age: member.age ?? '' });
    setFamErrors({});
    setFamModal({ mode: 'edit', member });
  };
  const updateFamForm = (k, v) => { setFamForm(f => ({ ...f, [k]: v })); if (famErrors[k]) setFamErrors(e => ({ ...e, [k]: null })); };
  const saveFam = async (evt) => {
    evt.preventDefault();
    const errs = {};
    if (!famForm.full_name.trim()) errs.full_name = 'Name is required';
    if (famForm.age !== '' && famForm.age !== null) {
      const n = Number(famForm.age);
      if (!Number.isFinite(n) || n < 0 || n > 150) errs.age = 'Enter a valid age';
    }
    setFamErrors(errs);
    if (Object.keys(errs).length) { focusFirstError(); return; }
    setFamSaving(true);
    try {
      const body = {
        full_name: famForm.full_name.trim(),
        relation: famForm.relation,
        ...(famForm.age !== '' && famForm.age !== null ? { age: Number(famForm.age) } : {}),
      };
      if (famModal.mode === 'edit') {
        const updated = await updateFamily(famModal.member.id, body);
        store.setFamilyMembers((store.familyMembers || []).map(f => (f.id === updated.id ? updated : f)));
        store.pushToast({ title: 'Family member updated', msg: `${updated.full_name} has been updated.` });
      } else {
        const created = await createFamily(body);
        store.setFamilyMembers([...(store.familyMembers || []), created]);
        store.pushToast({ title: 'Family member added', msg: 'You can now book appointments on their behalf.' });
      }
      setFamModal(null);
    } catch (err) {
      setFamErrors({ _form: err.message || 'Hindi na-save. Pakisubukang muli.' });
    } finally {
      setFamSaving(false);
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
      store.pushToast({ kind: 'error', title: 'Hindi natanggal', msg: err.message || 'Pakisubukang muli.' });
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
          <div className="card"><ErrorState title="Hindi ma-load ang profile" message={loadError || 'Profile not found.'} onRetry={() => window.location.reload()} /></div>
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
        <PageHeader title="Profile" subtitle="Manage your personal information."
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
              {saveMsg && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13.5,
                  background: saveMsg.kind === 'success' ? 'var(--success-soft)' : 'var(--error-soft)',
                  border: `1px solid ${saveMsg.kind === 'success' ? 'var(--success-border)' : 'var(--error-border)'}`,
                  color: saveMsg.kind === 'success' ? 'var(--success-text)' : 'var(--error-text)',
                }}>
                  {saveMsg.text}
                </div>
              )}
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
              <button type="button" className="btn btn-ghost" onClick={() => { setForm(toForm(me)); setErrors({}); setSaveMsg(null); }}>Reset</button>
              <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}>Save changes</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2 className="h-section">Family members</h2>
            <button className="btn btn-primary sm" onClick={openAddFam}><Icon name="user-plus" size={14} /> Add member</button>
          </div>
          <div className="card-body stack md">
            <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
              You can book appointments for the people below — they appear as options in the booking form's "Who is this visit for?" dropdown.
            </p>
            {(store.familyMembers || []).length === 0 ? (
              <EmptyState icon="users-round" title="No family members yet" message="Add one so you can book on their behalf."
                actions={<button className="btn btn-secondary" onClick={openAddFam}><Icon name="user-plus" size={14} /> Add family member</button>} />
            ) : (store.familyMembers || []).map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{f.full_name}</div>
                  <div className="t-muted" style={{ fontSize: 12 }}>
                    {f.relation}{f.age != null && f.age !== '' ? ` · ${f.age} yrs old` : ''}
                  </div>
                </div>
                <button type="button" className="btn-icon" title="Edit" aria-label={`Edit ${f.full_name}`} onClick={() => openEditFam(f)}>
                  <Icon name="pencil" size={16} />
                </button>
                <button type="button" className="btn-icon" title="Remove" aria-label={`Remove ${f.full_name}`} style={{ color: 'var(--error)' }} onClick={() => setConfirmRemoveFam(f)}>
                  <Icon name="trash-2" size={16} />
                </button>
              </div>
            ))}
          </div>
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

      <Modal
        open={!!famModal}
        onClose={() => setFamModal(null)}
        title={famModal?.mode === 'edit' ? 'Edit family member' : 'Add family member'}
        icon="user-plus" iconKind="info"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFamModal(null)} disabled={famSaving}>Cancel</button>
            <button className={`btn btn-primary ${famSaving ? 'btn-loading' : ''}`} onClick={saveFam} disabled={famSaving}>
              {famModal?.mode === 'edit' ? 'Save changes' : 'Add member'}
            </button>
          </>
        }
      >
        <form onSubmit={saveFam} noValidate>
          <div className="stack md">
            {famErrors._form && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 13.5,
                background: 'var(--error-soft)', border: '1px solid var(--error-border)',
                color: 'var(--error-text)',
              }}>
                {famErrors._form}
              </div>
            )}
            <Field label="Full name" required error={famErrors.full_name}>
              <TextInput value={famForm.full_name} onChange={e => updateFamForm('full_name', e.target.value)} error={famErrors.full_name} placeholder="e.g., Maria Bautista" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Relation">
                <SelectInput value={famForm.relation} onChange={e => updateFamForm('relation', e.target.value)}>
                  {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </SelectInput>
              </Field>
              <Field label="Age" error={famErrors.age} help="Optional">
                <TextInput type="number" min="0" max="150" value={famForm.age} onChange={e => updateFamForm('age', e.target.value)} error={famErrors.age} placeholder="e.g., 32" />
              </Field>
            </div>
          </div>
        </form>
      </Modal>

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
