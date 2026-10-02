// DoctorWeekView — doctor (Phase 5)
// Week schedule (Mon–Sun) + sariling weekly availability editor.
// Ang availability ang pinagmumulan ng fn_available_slots — ang pagbabago
// dito ay direktang nakakaapekto sa patient booking.
import { useEffect, useState } from 'react';
import {
  AppShell, EmptyState, ErrorState, Field, Icon, Modal, PageHeader,
  SelectInput, TextInput, useStore,
} from '../shared/components.jsx';
import {
  createDoctorAvailability, deleteDoctorAvailability, getDoctorAvailability,
  getDoctorWeek, updateDoctorAvailability, ApiError,
} from '../shared/api.js';
import { addDays, fmtDayShort, localToday, mondayOf, WEEKDAY_LABELS } from './helpers.js';
import { WeekGrid } from './WeekGrid.jsx';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function DoctorWeekView() {
  const store = useStore();
  const [weekStart, setWeekStart] = useState(() => mondayOf(localToday()));
  const [week, setWeek] = useState({ week_start: null, week_end: null, appointments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  // Availability editor state
  const [avail, setAvail] = useState([]);
  const [availLoading, setAvailLoading] = useState(true);
  const [availError, setAvailError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // availability entry o null (new)
  const [form, setForm] = useState({ weekday: 1, start_time: '08:00', end_time: '17:00' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadWeek = (start) => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDoctorWeek(start)
      .then((d) => {
        if (cancelled) return;
        setWeek(d);
        setWeekStart(d.week_start);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Could not load this week's schedule.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  };

  useEffect(() => loadWeek(mondayOf(localToday())), []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const goWeek = (delta) => loadWeek(addDays(weekStart, delta * 7));
  const goToday = () => loadWeek(mondayOf(localToday()));

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

  const removeEntry = async (entry) => {
    if (!window.confirm(`Remove ${WEEKDAY_LABELS[entry.weekday]} ${entry.start_time.slice(0, 5)}–${entry.end_time.slice(0, 5)}? This affects future patient bookings.`)) return;
    try {
      await deleteDoctorAvailability(entry.id);
      setAvail(list => list.filter(e => e.id !== entry.id));
      store.pushToast({ title: 'Availability removed', msg: 'Future bookings will follow the updated hours.' });
    } catch (err) {
      store.pushToast({ kind: 'error', title: 'Could not remove', msg: err instanceof ApiError ? err.message : 'Please try again.' });
    }
  };

  return (
    <AppShell current="d-week">
      <div className="page">
        <PageHeader
          title="This week"
          subtitle="Your appointments for the week, plus your weekly availability."
          breadcrumbs={[{ label: 'Home', to: '/doctor' }, { label: 'This week' }]}
          actions={
            <>
              <button className="btn btn-ghost sm" onClick={() => goWeek(-1)}><Icon name="chevron-left" size={14} /> Prev</button>
              <button className="btn btn-ghost sm" onClick={goToday}>This week</button>
              <button className="btn btn-ghost sm" onClick={() => goWeek(1)}>Next <Icon name="chevron-right" size={14} /></button>
            </>
          }
        />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            {loading ? (
              <p className="t-muted" style={{ fontSize: 13.5 }}>Loading week…</p>
            ) : error ? (
              <ErrorState title="Could not load week" message={error} onRetry={() => loadWeek(weekStart)} />
            ) : (
              <WeekGrid
                weekStart={week.week_start}
                weekEnd={week.week_end}
                appointments={week.appointments}
                selectedId={selected?.id}
                onSelect={setSelected}
                today={localToday()}
              />
            )}
          </div>
        </div>

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
                      <button className="btn btn-ghost sm" onClick={() => removeEntry(e)}><Icon name="trash-2" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{selected.patient?.full_name || selected.booked_for || 'Patient'}</strong>
                <div className="t-muted" style={{ fontSize: 12.5 }}>
                  {fmtDayShort(selected.appointment_date)} · {selected.reason || '—'} · Ref {selected.reference_code}
                </div>
              </div>
              <button className="btn btn-secondary sm" onClick={() => setSelected(null)}>Clear selection</button>
            </div>
          </div>
        )}
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
    </AppShell>
  );
}

export { DoctorWeekView };
export default DoctorWeekView;
