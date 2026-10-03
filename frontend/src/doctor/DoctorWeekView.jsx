// DoctorWeekView — doctor portal
// This week (Mon–Sun grid) + weekly availability editor. The availability
// is the source of fn_available_slots — changes here directly affect
// patient booking.
import { useEffect, useState } from 'react';
import {
  AppShell, ConfirmModal, EmptyState, ErrorState, Field, Icon, Modal, navigate, PageHeader,
  PageSpinner, SelectInput, TextInput, useStore,
} from '../shared/components.jsx';
import {
  createDoctorAvailability, deleteDoctorAvailability, getDoctorAvailability,
  getDoctorWeek, updateDoctorAvailability, ApiError,
} from '../shared/api.js';
import { fmtDayShort, getWeekDays, localToday, mondayOf, WEEKDAY_LABELS } from './helpers.js';
import { WeekGrid } from './WeekGrid.jsx';
import { formatDate } from '../shared/data.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function DoctorWeekView() {
  const store = useStore();
  const today = localToday();
  const weekDays = getWeekDays();
  const weekLabel = `${formatDate(weekDays[0])} – ${formatDate(weekDays[6])}`;
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // Availability editor state
  const [avail, setAvail] = useState([]);
  const [availLoading, setAvailLoading] = useState(true);
  const [availError, setAvailError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ weekday: 1, start_time: '08:00', end_time: '17:00' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDoctorWeek(mondayOf(today))
      .then((d) => {
        if (cancelled) return;
        setMine(d.appointments || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Could not load this week's schedule.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAvail = () => {
    let cancelled = false;
    setAvailLoading(true);
    setAvailError('');
    getDoctorAvailability()
      .then((list) => { if (!cancelled) { setAvail(list); setAvailLoading(false); } })
      .catch((err) => { if (!cancelled) { setAvailError(err.message || 'Could not load availability.'); setAvailLoading(false); } });
    return () => { cancelled = true; };
  };

  useEffect(loadAvail, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekCount = mine.filter(a => weekDays.includes(a.appointment_date)).length;

  const openNew = () => {
    setEditing(null);
    setForm({ weekday: 1, start_time: '08:00', end_time: '17:00' });
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ weekday: entry.weekday, start_time: entry.start_time.slice(0, 5), end_time: entry.end_time.slice(0, 5) });
    setFormError('');
    setEditorOpen(true);
  };

  const saveEntry = async () => {
    if (!TIME_RE.test(form.start_time) || !TIME_RE.test(form.end_time)) {
      setFormError('Use HH:MM (24-hour) format.');
      return;
    }
    if (form.start_time >= form.end_time) {
      setFormError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const updated = await updateDoctorAvailability(editing.id, form);
        setAvail(list => list.map(e => (e.id === updated.id ? updated : e)));
        store.pushToast({ title: 'Availability updated', msg: `${WEEKDAY_LABELS[form.weekday]} ${form.start_time}–${form.end_time}.` });
      } else {
        const created = await createDoctorAvailability(form);
        setAvail(list => [...list, created].sort((a, b) => a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time))));
        store.pushToast({ title: 'Availability added', msg: `${WEEKDAY_LABELS[form.weekday]} ${form.start_time}–${form.end_time}.` });
      }
      setEditorOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async () => {
    const entry = deleteTarget;
    if (!entry) return;
    setDeleting(true);
    try {
      await deleteDoctorAvailability(entry.id);
      setAvail(list => list.filter(e => e.id !== entry.id));
      store.pushToast({ title: 'Availability removed', msg: 'Future bookings will follow the updated hours.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not remove', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <AppShell current="d-week">
      <div className="page">
        <PageHeader
          title="This week"
          subtitle={weekLabel}
          breadcrumbs={[{ label: 'Doctor portal', to: '/doctor/dashboard' }, { label: 'This week' }]}
          actions={<button className="btn btn-secondary" onClick={() => navigate('/doctor/dashboard')}><Icon name="calendar-check" size={14} /> Today's schedule</button>}
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h2 className="h-section">Week view</h2>
            <span className="t-muted" style={{ fontSize: 12 }}>
              {loading ? '…' : `${weekCount} appointment${weekCount === 1 ? '' : 's'} · today's column is highlighted`}
            </span>
          </div>
          <div className="card-body compact">
            {loading ? (
              <PageSpinner />
            ) : error ? (
              <ErrorState title="Could not load week" message={error} onRetry={() => setRetryKey(k => k + 1)} />
            ) : (
              <WeekGrid mine={mine} weekDays={weekDays} today={today} />
            )}
          </div>
        </div>

        <p className="t-help" style={{ margin: '0 0 16px' }}>
          Full detail (time · patient · status) shows on hover over each appointment chip.
        </p>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="h-section">My weekly availability</h2>
            <button className="btn btn-primary sm" onClick={openNew}><Icon name="plus" size={14} /> Add hours</button>
          </div>
          <div className="card-body">
            <p className="t-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Patient booking slots are generated from these hours. Changes apply to future bookings.
            </p>
            {availLoading ? (
              <p className="t-muted" style={{ fontSize: 13.5 }}>Loading availability…</p>
            ) : availError ? (
              <ErrorState title="Could not load availability" message={availError} onRetry={loadAvail} />
            ) : avail.length === 0 ? (
              <EmptyState icon="clock" title="No availability set" message="Add your weekly hours so patients can book appointments." />
            ) : (
              <div className="stack sm">
                {avail.map(e => (
                  <div key={e.id} className="card" style={{ background: 'var(--surface)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Icon name="clock" size={16} style={{ color: 'var(--primary)' }} />
                      <div style={{ flex: 1 }}>
                        <strong>{WEEKDAY_LABELS[e.weekday]}</strong>
                        <span className="t-muted" style={{ marginLeft: 8, fontSize: 13.5 }}>
                          {e.start_time.slice(0, 5)} – {e.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <button className="btn btn-ghost sm" onClick={() => openEdit(e)}><Icon name="pencil" size={14} /> Edit</button>
                      <button className="btn btn-ghost sm" onClick={() => setDeleteTarget(e)}><Icon name="trash-2" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Edit availability' : 'Add availability'}
        icon="clock"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={saveEntry} disabled={saving}>
              {editing ? 'Save changes' : 'Add hours'}
            </button>
          </>
        }
      >
        <div className="stack md">
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13.5, background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
              {formError}
            </div>
          )}
          <Field label="Day of week" required>
            <SelectInput value={form.weekday} onChange={e => setForm(f => ({ ...f, weekday: Number(e.target.value) }))}>
              {[1, 2, 3, 4, 5, 6, 7].map(w => (
                <option key={w} value={w}>{WEEKDAY_LABELS[w]}</option>
              ))}
            </SelectInput>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Start time" required>
              <TextInput type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </Field>
            <Field label="End time" required>
              <TextInput type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove availability?"
        message={deleteTarget ? `Remove ${WEEKDAY_LABELS[deleteTarget.weekday]} ${deleteTarget.start_time.slice(0, 5)}–${deleteTarget.end_time.slice(0, 5)}? This affects future patient bookings.` : ''}
        confirmLabel="Remove"
        onConfirm={removeEntry}
        loading={deleting}
      />
    </AppShell>
  );
}

export { DoctorWeekView };
export default DoctorWeekView;
