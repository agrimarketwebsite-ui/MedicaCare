// Shared helpers — doctor portal (mga pure functions lang, walang store).
// Sinusundan ang visual/copy patterns ng patient portal.

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

export {
  fmtTime12, localToday, parseDay, fmtDayShort, fmtDateLong,
  weekDays, addDays, mondayOf, WEEKDAY_LABELS, starsDisplay,
};
