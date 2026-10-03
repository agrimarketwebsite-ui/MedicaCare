// WeekGrid — doctor portal
// Shared Mon–Sun week grid — used by the This week page (/doctor/week).
// Today's column is highlighted, past days read as history; compact chips
// use a left status color bar (calendar convention), full detail on hover.
import { timeValue } from '../shared/data.js';
import { shortName } from './helpers.js';

function WeekGrid({ mine, weekDays, today }) {
  return (
    <div className="doctor-week-grid">
      {weekDays.map(iso => {
        const dt = new Date(iso + 'T00:00:00');
        const dayAppts = mine
          .filter(a => a.appointment_date === iso)
          .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
        return (
          <div key={iso} className={'doctor-week-day' + (iso === today ? ' today' : iso < today ? ' past' : '')}>
            <div className="dw-day-head">
              <span className="dw-day-name">{dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                {dayAppts.length > 0 && <span className="dw-count">{dayAppts.length}</span>}
                <span className="dw-day-num">{dt.getDate()}</span>
              </span>
            </div>
            {dayAppts.length === 0 ? null : dayAppts.map(a => {
              const patientName = a.patient?.full_name || a.booked_for || 'Patient';
              const label = `${a.start_time ? a.start_time.slice(0, 5) : ''} · ${patientName} · ${window.statusMeta(a.status).label}`;
              return (
                <div key={a.id} className={'dw-appt st-' + a.status}
                  tabIndex={0}
                  aria-label={label}
                  title={label}>
                  <span className="dw-dot" aria-hidden="true" />
                  <span className="dw-body">
                    <span className="dw-time">{a.start_time ? a.start_time.slice(0, 5) : ''}</span>
                    <span className="dw-pat">{shortName(patientName)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export { WeekGrid };
export default WeekGrid;
