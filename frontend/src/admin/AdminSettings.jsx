// AdminSettings — clinic info + appointment preferences (Phase 6).
// Prototype UI restored: "Clinic information" and "Appointment preferences"
// cards with card-header/h-section headings and card-footer save buttons.
// Real API: getClinicInfo/updateClinicInfo, getAppSettings/updateAppSettings.
// The two email-notification checkboxes have no backend fields yet — they
// render disabled with a "Coming soon" note.
import { useEffect, useState } from 'react';
import {
  AppShell, ErrorState, Field, PageHeader, PageSpinner,
  SelectInput, TextInput, useStore,
} from '../shared/components.jsx';
import {
  getAppSettings, getClinicInfo, updateAppSettings, updateClinicInfo, ApiError,
} from '../shared/api.js';

function AdminSettings() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clinic, setClinic] = useState({ name: '', phone: '', email: '', address: '', hours: '' });
  const [prefs, setPrefs] = useState({ autoConfirm: false, slotInterval: 30 });
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  // Inline field error: empty clinic name is shown next to the field itself
  const [clinicError, setClinicError] = useState('');
  const updateClinic = (k, v) => setClinic((f) => ({ ...f, [k]: v }));
  const updatePref = (k, v) => setPrefs((f) => ({ ...f, [k]: v }));
  const focusNameField = () => {
    const el = document.getElementById('clinic-name');
    if (el) el.focus();
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [c, a] = await Promise.all([getClinicInfo(), getAppSettings()]);
      setClinic({
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        hours: typeof c.hours === 'string' ? c.hours : '',
      });
      setPrefs({
        autoConfirm: Boolean(a.auto_confirm_appointments),
        slotInterval: Number(a.slot_interval_minutes ?? 30),
      });
    } catch (err) {
      setError(err.message || 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveClinic = async (e) => {
    e.preventDefault();
    if (!clinic.name.trim()) {
      setClinicError('Clinic name is required');
      focusNameField();
      return;
    }
    setSavingClinic(true);
    try {
      const body = { name: clinic.name.trim() };
      if (clinic.phone.trim()) body.phone = clinic.phone.trim();
      if (clinic.email.trim()) body.email = clinic.email.trim();
      if (clinic.address.trim()) body.address = clinic.address.trim();
      if (clinic.hours.trim()) body.hours = clinic.hours.trim();
      const saved = await updateClinicInfo(body);
      store.pushToast({ kind: 'success', title: 'Clinic info saved', message: 'The public website now shows the updated details.' });
      setClinic((prev) => ({ ...prev, ...saved }));
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Save failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setSavingClinic(false);
    }
  };

  const savePrefs = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const saved = await updateAppSettings({
        auto_confirm_appointments: prefs.autoConfirm,
        slot_interval_minutes: prefs.slotInterval,
      });
      store.pushToast({
        kind: 'success',
        title: 'Preferences saved',
        message: prefs.autoConfirm
          ? 'New patient bookings will be confirmed instantly.'
          : 'New patient bookings will wait for staff review.',
      });
      setPrefs((prev) => ({
        ...prev,
        autoConfirm: Boolean(saved.auto_confirm_appointments ?? prev.autoConfirm),
        slotInterval: Number(saved.slot_interval_minutes ?? prev.slotInterval),
      }));
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Save failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <AppShell current="settings">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="Settings"
          subtitle="Clinic information and appointment preferences."
          breadcrumbs={[{ label: 'Home', to: '/admin/dashboard' }, { label: 'Settings' }]}
        />

        {loading ? (
          <PageSpinner />
        ) : error ? (
          <ErrorState title="Could not load settings" message={error} onRetry={load} />
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><h2 className="h-section">Clinic information</h2></div>
              <form onSubmit={saveClinic}>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Clinic name" required error={clinicError} htmlFor="clinic-name">
                      <TextInput
                        id="clinic-name"
                        value={clinic.name}
                        onChange={(ev) => { updateClinic('name', ev.target.value); if (clinicError) setClinicError(''); }}
                        error={clinicError}
                        maxLength={160}
                      />
                    </Field>
                    <Field label="Contact number" required>
                      <TextInput type="tel" value={clinic.phone} onChange={(ev) => updateClinic('phone', ev.target.value)} icon="phone" maxLength={40} />
                    </Field>
                    <Field label="Email" required>
                      <TextInput type="email" value={clinic.email} onChange={(ev) => updateClinic('email', ev.target.value)} icon="mail" maxLength={160} />
                    </Field>
                    <Field label="Address">
                      <TextInput value={clinic.address} onChange={(ev) => updateClinic('address', ev.target.value)} maxLength={500} />
                    </Field>
                    <Field label="Hours" help="Optional.">
                      <TextInput
                        value={clinic.hours}
                        onChange={(ev) => updateClinic('hours', ev.target.value)}
                        placeholder="e.g. Mon–Sat, 8:00 AM – 6:00 PM"
                        maxLength={160}
                      />
                    </Field>
                  </div>
                </div>
                <div className="card-footer">
                  <button type="submit" className={`btn btn-primary ${savingClinic ? 'btn-loading' : ''}`} disabled={savingClinic}>
                    {savingClinic ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <div className="card-header"><h2 className="h-section">Appointment preferences</h2></div>
              <form onSubmit={savePrefs}>
                <div className="card-body stack lg">
                  <label className="checkbox" style={{ opacity: 0.55 }}>
                    <input type="checkbox" disabled />
                    <span>Email admins when a new appointment is booked <span className="t-muted">· Coming soon</span></span>
                  </label>
                  <label className="checkbox" style={{ opacity: 0.55 }}>
                    <input type="checkbox" disabled />
                    <span>Send patients a reminder email the day before their visit <span className="t-muted">· Coming soon</span></span>
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" checked={prefs.autoConfirm} onChange={(ev) => updatePref('autoConfirm', ev.target.checked)} />
                    <span>Auto-confirm pending appointments (skip manual review)</span>
                  </label>
                  <Field label="Appointment slot interval" help="Time slots offered on the patient booking form. Hourly shows :00 slots only. The booking grid runs on 30-minute granularity.">
                    <SelectInput value={String(prefs.slotInterval)} onChange={(ev) => updatePref('slotInterval', Number(ev.target.value))}>
                      <option value="15">Every 15 minutes</option>
                      <option value="30">Every 30 minutes</option>
                      <option value="60">Every 1 hour</option>
                    </SelectInput>
                  </Field>
                </div>
                <div className="card-footer">
                  <button type="submit" className={`btn btn-primary ${savingPrefs ? 'btn-loading' : ''}`} disabled={savingPrefs}>
                    {savingPrefs ? 'Saving…' : 'Save preferences'}
                  </button>
                </div>
              </form>
            </div>

            <p className="t-muted" style={{ fontSize: 12, marginTop: 12 }}>
              Clinic info updates the public website, and preferences drive the patient booking flow.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

export { AdminSettings };
