// AdminSettings — clinic info + app settings (Phase 6).
// Two independent forms:
//   clinic_info: { clinic_name, phone, email, address, hours }
//   app_settings: { auto_confirm_appointments (toggle),
//                   slot_interval_minutes (select), ... }
import { useEffect, useState } from 'react';
import {
  AppShell, ErrorState, Field, PageHeader, PageSpinner,
  SelectInput, TextArea, TextInput, useStore,
} from '../shared/components.jsx';
import {
  getAppSettings, getClinicInfo, updateAppSettings, updateClinicInfo, ApiError,
} from '../shared/api.js';

function AdminSettings() {
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clinic, setClinic] = useState({ clinic_name: '', phone: '', email: '', address: '', hours: '' });
  const [appCfg, setAppCfg] = useState({ auto_confirm_appointments: false, slot_interval_minutes: 30 });
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingApp, setSavingApp] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [c, a] = await Promise.all([getClinicInfo(), getAppSettings()]);
      setClinic({
        clinic_name: c.clinic_name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        hours: c.hours || '',
      });
      setAppCfg({
        auto_confirm_appointments: Boolean(a.auto_confirm_appointments),
        slot_interval_minutes: Number(a.slot_interval_minutes ?? 30),
      });
    } catch (err) {
      setError(err.message || 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveClinic = async () => {
    setSavingClinic(true);
    try {
      const saved = await updateClinicInfo({
        clinic_name: clinic.clinic_name.trim(),
        phone: clinic.phone.trim() || null,
        email: clinic.email.trim() || null,
        address: clinic.address.trim() || null,
        hours: clinic.hours.trim() || null,
      });
      store.pushToast({ kind: 'success', title: 'Clinic info saved', message: 'Public pages will show the updated details.' });
      setClinic((prev) => ({ ...prev, ...saved }));
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Save failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setSavingClinic(false);
    }
  };

  const saveApp = async () => {
    setSavingApp(true);
    try {
      const saved = await updateAppSettings({
        auto_confirm_appointments: appCfg.auto_confirm_appointments,
        slot_interval_minutes: appCfg.slot_interval_minutes,
      });
      store.pushToast({ kind: 'success', title: 'App settings saved', message: 'Booking behavior was updated.' });
      setAppCfg((prev) => ({ ...prev, ...saved }));
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Save failed', message: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setSavingApp(false);
    }
  };

  return (
    <AppShell current="settings">
      <div className="page">
        <PageHeader
          title="Settings"
          subtitle="Clinic information and booking behavior."
          breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Settings' }]}
        />

        {loading ? (
          <PageSpinner />
        ) : error ? (
          <ErrorState title="Could not load settings" message={error} onRetry={load} />
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <h3 style={{ margin: '0 0 12px' }}>Clinic info</h3>
                <div className="form-grid">
                  <Field label="Clinic name">
                    <TextInput
                      value={clinic.clinic_name}
                      onChange={(e) => setClinic((c) => ({ ...c, clinic_name: e.target.value }))}
                      maxLength={160}
                    />
                  </Field>
                  <Field label="Phone">
                    <TextInput
                      value={clinic.phone}
                      onChange={(e) => setClinic((c) => ({ ...c, phone: e.target.value }))}
                      maxLength={40}
                    />
                  </Field>
                  <Field label="Email">
                    <TextInput
                      type="email"
                      value={clinic.email}
                      onChange={(e) => setClinic((c) => ({ ...c, email: e.target.value }))}
                      maxLength={160}
                    />
                  </Field>
                  <Field label="Hours">
                    <TextInput
                      value={clinic.hours}
                      onChange={(e) => setClinic((c) => ({ ...c, hours: e.target.value }))}
                      placeholder="e.g. Mon–Sat, 8:00 AM – 6:00 PM"
                      maxLength={160}
                    />
                  </Field>
                  <Field label="Address">
                    <TextArea
                      value={clinic.address}
                      onChange={(e) => setClinic((c) => ({ ...c, address: e.target.value }))}
                      rows={2}
                      maxLength={500}
                    />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={saveClinic} disabled={savingClinic}>
                    {savingClinic ? 'Saving…' : 'Save clinic info'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 style={{ margin: '0 0 12px' }}>Booking behavior</h3>
                <Field
                  label="Auto-confirm appointments"
                  help="When on, new patient bookings are confirmed immediately instead of waiting as pending."
                >
                  <SelectInput
                    value={appCfg.auto_confirm_appointments ? 'on' : 'off'}
                    onChange={(e) => setAppCfg((a) => ({ ...a, auto_confirm_appointments: e.target.value === 'on' }))}
                    style={{ maxWidth: 220 }}
                  >
                    <option value="on">On — auto-confirm</option>
                    <option value="off">Off — bookings start as pending</option>
                  </SelectInput>
                </Field>
                <Field
                  label="Slot interval"
                  help="Length of each bookable time slot in minutes."
                >
                  <SelectInput
                    value={String(appCfg.slot_interval_minutes)}
                    onChange={(e) => setAppCfg((a) => ({ ...a, slot_interval_minutes: Number(e.target.value) }))}
                    style={{ maxWidth: 220 }}
                  >
                    {[15, 20, 30, 45, 60].map((m) => (
                      <option key={m} value={String(m)}>{m} minutes</option>
                    ))}
                  </SelectInput>
                </Field>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={saveApp} disabled={savingApp}>
                    {savingApp ? 'Saving…' : 'Save app settings'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export { AdminSettings };
