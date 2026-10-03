// Shared helpers — doctor portal (mga pure functions lang, walang store).
// Sinusundan ang visual/copy patterns ng patient portal.
import { useStore } from '../shared/components.jsx';
import { findDoctor } from '../shared/data.js';

/** "HH:MM:SS" (24h, galing sa API) → "h:mm AM/PM" para sa display. */
function fmtTime12(hhmmss) {
  const m = String(hhmmss || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(hhmmss || '—');
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

/** Local (not UTC) YYYY-MM-DD — "today" sa timezone ng user. */
function localToday() {
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

/** YYYY-MM-DD → Date (UTC noon, iwas timezone shift). */
function parseDay(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** YYYY-MM-DD → "Mon, Oct 5" (maikling label para sa week grid). */
function fmtDayShort(dateStr) {
  const dt = parseDay(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getUTCDay()]}, ${months[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
}

/** YYYY-MM-DD → "Monday, October 5, 2026" (gamit ang window formatter kapag available). */
function fmtDateLong(dateStr) {
  if (typeof window !== 'undefined' && window.formatDateLong) return window.formatDateLong(dateStr);
  const dt = parseDay(dateStr);
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Pitong araw (Mon–Sun) mula sa week_start na YYYY-MM-DD. */
function weekDays(weekStart) {
  const start = parseDay(weekStart);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** YYYY-MM-DD → YYYY-MM-DD, n araw ang offset (pabalik kapag negative). */
function addDays(dateStr, n) {
  const d = parseDay(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday ng linggong naglalaman ng dateStr (YYYY-MM-DD). */
function mondayOf(dateStr) {
  const d = parseDay(dateStr);
  const jsDay = d.getUTCDay(); // 0 = Sun
  d.setUTCDate(d.getUTCDate() - ((jsDay + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
  5: 'Friday', 6: 'Saturday', 7: 'Sunday',
};

/** 1–5 stars → ★ string para sa display. */
function starsDisplay(stars) {
  const n = Math.round(Number(stars) || 0);
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

// The logged-in doctor's record (fallback keeps pages rendering if the
// doctor was removed from the directory)
function useDoctor() {
  const store = useStore();
  return (store.doctorSession && findDoctor(store.doctorSession.doctorId))
    || { id: '', name: 'Unknown doctor', specialty: '—', room: '—' };
}

// Short name for the compact week-view chips ("Juan Miguel B." style)
function shortName(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

// After inline validation fails, move focus to the first invalid field so
// keyboard and screen-reader users land straight on what needs fixing.
function focusFirstError() {
  const el = document.querySelector('.input.error, .textarea.error, .select.error');
  if (el) el.focus();
}

// Mon–Sun ISO dates of the current week
function getWeekDays() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

export {
  fmtTime12, localToday, parseDay, fmtDayShort, fmtDateLong,
  weekDays, addDays, mondayOf, WEEKDAY_LABELS, starsDisplay,
  useDoctor, shortName, focusFirstError, getWeekDays,
};
