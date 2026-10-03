// DoctorFormModal — add/edit doctor + portal access management (Phase 6).
// Props: open, onClose, initial? (doctor row — kapag may laman, edit mode),
// onSaved(savedDoctor).
//
// Doctor row shape (tulad ng GET /api/doctors): id, full_name,
// specialty_name, specialty_id, status ('active'/'inactive'),
// years_of_experience, consultation_fee, room, gender, photo_url,
// avg_rating, rating_count. Portal access: inaasahan ang
// `portal_email` / `has_portal_access` sa row (backend contract); kung wala,
// ipinapalagay na walang portal account hangga't hindi naka-grant.
import { useEffect, useState } from 'react';
import {
  ConfirmModal, Field, Modal, SelectInput, TextArea, TextInput, useStore,
} from '../shared/components.jsx';
import {
  createAdminDoctor, grantDoctorAccess, resetDoctorPassword,
  revokeDoctorAccess, updateAdminDoctor, ApiError,
} from '../shared/api.js';

const EMPTY = {
  full_name: '',
  specialty: '',
  status: 'active',
  years_experience: '',
  consultation_fee: '',
  room: '',
  gender: '',
  bio: '',
};

function DoctorFormModal({ open, onClose, initial, onSaved }) {
  const store = useStore();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);

  // --- portal access state ---
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPassword, setGrantPassword] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? {
      full_name: initial.full_name || '',
      specialty: initial.specialty_name || initial.specialty || '',
      status: initial.status || 'active',
      years_experience: initial.years_of_experience ?? initial.years_experience ?? '',
      consultation_fee: initial.consultation_fee ?? '',
      room: initial.room || '',
      gender: initial.gender || '',
      bio: initial.bio || '',
    } : EMPTY);
    setError('');
    setSaving(false);
    setGrantEmail(initial?.portal_email || '');
    setGrantPassword('');
    setTempPassword('');
    setPortalError('');
    setPortalBusy(false);
    setConfirmRevoke(false);
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hasPortal = Boolean(initial?.has_portal_access || initial?.portal_email);

  const doSave = async () => {
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.specialty.trim()) { setError('Specialty is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        full_name: form.full_name.trim(),
        specialty_name: form.specialty.trim(),
        status: form.status,
        years_of_experience: form.years_experience === '' ? null : Number(form.years_experience),
        consultation_fee: form.consultation_fee === '' ? null : Number(form.consultation_fee),
        room: form.room.trim() || null,
        gender: form.gender || null,
        bio: form.bio.trim() || null,
      };
      const saved = editing
        ? await updateAdminDoctor(initial.id, body)
        : await createAdminDoctor(body);
      store.pushToast({
        kind: 'success',
        title: editing ? 'Doctor updated' : 'Doctor added',
        message: `${saved.full_name} has been ${editing ? 'updated' : 'added to the directory'}.`,
      });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the doctor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const portalToast = (title, message) => store.pushToast({ kind: 'success', title, message });

  const doGrant = async () => {
    if (!grantEmail.trim() || !grantPassword) { setPortalError('Enter an email and a password to grant access.'); return; }
    setPortalBusy(true);
    setPortalError('');
    try {
      const saved = await grantDoctorAccess(initial.id, { email: grantEmail.trim(), password: grantPassword });
      portalToast('Portal access granted', `Login credentials were created for ${saved.email}.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setPortalError(err instanceof ApiError ? err.message : 'Could not grant portal access.');
    } finally {
      setPortalBusy(false);
    }
  };

  const doResetPassword = async () => {
    setPortalBusy(true);
    setPortalError('');
    try {
      // Ang server ang nagge-generate ng temporary password — ipinapakita
      // ito para maibigay ng admin sa doctor (hindi sine-save sa modal).
      const data = await resetDoctorPassword(initial.id);
      setTempPassword(data?.password || '');
      portalToast('Password reset', 'Give the temporary password below to the doctor.');
    } catch (err) {
      setPortalError(err instanceof ApiError ? err.message : 'Could not reset the password.');
    } finally {
      setPortalBusy(false);
    }
  };

  const doRevoke = async () => {
    setPortalBusy(true);
    setPortalError('');
    try {
      const saved = await revokeDoctorAccess(initial.id);
      portalToast('Portal access revoked', 'The doctor can no longer log in to the doctor portal.');
      setConfirmRevoke(false);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setPortalError(err instanceof ApiError ? err.message : 'Could not revoke portal access.');
    } finally {
      setPortalBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit doctor' : 'Add doctor'}
      subtitle={editing ? `Editing ${initial?.full_name || ''}` : 'Add a new doctor to the directory.'}
      icon="stethoscope"
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={doSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add doctor'}
          </button>
        </>
      }
    >
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Full name" required>
          <TextInput value={form.full_name} onChange={set('full_name')} placeholder="Dr. Maria Santos" maxLength={120} />
        </Field>
        <Field label="Specialty" required>
          <TextInput value={form.specialty} onChange={set('specialty')} placeholder="e.g. Cardiology" maxLength={120} />
        </Field>
        <Field label="Status">
          <SelectInput value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectInput>
        </Field>
        <Field label="Years of experience">
          <TextInput type="number" min="0" max="80" value={form.years_experience} onChange={set('years_experience')} />
        </Field>
        <Field label="Consultation fee (₱)">
          <TextInput type="number" min="0" step="1" value={form.consultation_fee} onChange={set('consultation_fee')} />
        </Field>
        <Field label="Room">
          <TextInput value={form.room} onChange={set('room')} placeholder="e.g. Room 204" maxLength={40} />
        </Field>
        <Field label="Gender">
          <SelectInput value={form.gender} onChange={set('gender')}>
            <option value="">—</option>
            <option value="male">male</option>
            <option value="female">female</option>
            <option value="other">other</option>
          </SelectInput>
        </Field>
        <Field label="Bio">
          <TextArea value={form.bio} onChange={set('bio')} rows={3} maxLength={2000} placeholder="Short professional bio…" />
        </Field>
      </div>

      {/* ---------- Portal access ---------- */}
      {editing && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body">
            <h4 style={{ margin: '0 0 4px' }}>Doctor portal access</h4>
            <p className="t-muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
              {hasPortal
                ? `This doctor can log in to the doctor portal${initial.portal_email ? ` as ${initial.portal_email}` : ''}.`
                : 'This doctor has no portal account yet — grant one so they can log in to the doctor portal.'}
            </p>
            {portalError && <div className="form-error" role="alert">{portalError}</div>}
            {hasPortal ? (
              <>
                {tempPassword ? (
                  <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--success-soft, #d1fae5)', border: '1px solid var(--border)' }}>
                    <div className="t-muted" style={{ fontSize: 12, marginBottom: 4 }}>Temporary password — give this to the doctor:</div>
                    <code style={{ fontSize: 16, fontWeight: 700, userSelect: 'all' }}>{tempPassword}</code>
                  </div>
                ) : (
                  <p className="t-muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                    Generate a temporary password for this doctor's portal login.
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary sm" onClick={doResetPassword} disabled={portalBusy}>
                    {portalBusy ? 'Working…' : 'Generate new password'}
                  </button>
                  <button className="btn btn-danger sm" onClick={() => setConfirmRevoke(true)} disabled={portalBusy}>
                    Revoke access
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <Field label="Portal email" required>
                    <TextInput type="email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="doctor@medicacare.ph" />
                  </Field>
                  <Field label="Password" required>
                    <TextInput type="password" value={grantPassword} onChange={(e) => setGrantPassword(e.target.value)} placeholder="Min. 8 chars, letter + number" />
                  </Field>
                </div>
                <button className="btn btn-secondary sm" onClick={doGrant} disabled={portalBusy}>
                  {portalBusy ? 'Working…' : 'Grant portal access'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={doRevoke}
        loading={portalBusy}
        title="Revoke portal access?"
        message={`This will immediately prevent ${initial?.full_name || 'this doctor'} from logging in to the doctor portal. Their directory profile stays in place.`}
        confirmLabel="Revoke access"
      />
    </Modal>
  );
}

export { DoctorFormModal };
