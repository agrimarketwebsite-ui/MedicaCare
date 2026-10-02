// backend/shared/utils/manilaTime.js
// Phase 4 — Asia/Manila date/time helpers.
// Ang clinic ay nasa Pilipinas: ang "today" / "past slot" rules (booking,
// reschedule, slots query) ay laging naka-base sa Manila wall-clock, hindi sa
// server timezone o sa client. Pure Intl — walang env dependency.

/** Kasalukuyang petsa sa Manila bilang 'YYYY-MM-DD' (en-CA = ISO order). */
export function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

/** Kasalukuyang oras sa Manila bilang 'HH:MM' (24-hour, h23 — walang '24:xx'). */
export function manilaNowHHMM() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export default { manilaToday, manilaNowHHMM };
