// WeekGrid — doctor (Phase 5)
// Pitong araw (Mon–Sun) na grid; bawat araw ay may listahan ng appointments.
// Ginagamit ng DoctorWeekView. Ang pag-click sa appointment ay nagbabalik
// nito sa parent (onSelect) — ang actions ay nasa dashboard/detail level.
import { EmptyState, StatusBadge } from '../shared/components.jsx';
import { fmtDayShort, fmtTime12, weekDays } from './helpers.js';

function statusLabel(status) {
  return { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', 'no-show': 'No-show' }[status] || status;
}

// Tugma sa DoctorDashboard — status rail ng bawat appointment chip.
const STATUS_ACCENT = {
  pending: '#d97706',
  confirmed: 'var(--primary)',
  completed: '#059669',
  cancelled: '#9ca3af',
  'no-show': '#dc2626',
};

function WeekGrid({ weekStart, weekEnd, appointments, selectedId, onSelect, today }) {
  const days = weekStart ? weekDays(weekStart) : [];
  const byDate = {};
  for (const a of appointments || []) {
    (byDate[a.appointment_date] ||= []).push(a);
  }

  if (!weekStart) {
    return <EmptyState icon="calendar-x" title="No week selected" message="Pick a week to view the schedule." />;
  }

  return (
    <div>
      <div className="t-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        Week of {fmtDayShort(weekStart)} – {fmtDayShort(weekEnd)}
      </div>
      <div className="week-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
        {days.map((date) => {
          const list = (byDate[date] || []).slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
          const isToday = date === today;
          return (
            <div
              key={date}
              className="card"
              style={{
                minHeight: 108,
                borderColor: isToday ? 'var(--primary)' : undefined,
                borderWidth: isToday ? 2 : undefined,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700 }}>
                <div>{fmtDayShort(date)}</div>
                {isToday && <span className="t-help" style={{ fontWeight: 600, color: 'var(--primary)' }}>Today</span>}
              </div>
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {list.length === 0 ? (
                  <span className="t-muted" style={{ fontSize: 11.5, padding: '2px 4px' }}>—</span>
                ) : (
                  list.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect?.(a)}
                      className="week-slot"
                      style={{
                        textAlign: 'left',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${STATUS_ACCENT[a.status] || '#9ca3af'}`,
                        borderRadius: 8,
                        padding: '5px 7px',
                        background: selectedId === a.id ? 'var(--primary-soft)' : 'var(--surface)',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                      title={`${a.patient?.full_name || a.booked_for || 'Patient'} — ${statusLabel(a.status)}`}
                    >
                      <div style={{ fontWeight: 700 }}>{fmtTime12(a.start_time)}</div>
                      <div className="t-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.patient?.full_name || a.booked_for || 'Patient'}
                      </div>
                      <StatusBadge status={a.status} />
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { WeekGrid, statusLabel };
export default WeekGrid;
