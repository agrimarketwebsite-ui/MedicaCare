// Shared helpers — admin console.
import { downloadFile, formatDate, formatDayRange, statusMeta } from '../shared/data.js';

// CSV export helpers (downloadFile is the shared helper from data.js)
// ============================================================
function csvCell(v) {
  let s = String(v == null ? '' : v);
  // A leading =, +, -, @, TAB or CR makes Excel/LibreOffice treat the cell as
  // a formula — prefix it with an apostrophe so exported free-text fields
  // (patient name, reason for visit, message subject…) stay inert text.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// rows = array of arrays; first row is the header. BOM keeps Excel happy with ₱.
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  downloadFile(filename, '﻿' + csv, 'text/csv;charset=utf-8');
}

// Local (not UTC) YYYY-MM-DD so "today" matches the user's timezone
function localToday() {
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// After inline validation fails, move focus to the first invalid field so
// keyboard and screen-reader users land straight on what needs fixing.
// The shared TextInput/TextArea/SelectInput carry an .error class whenever
// their error prop is set.
function focusFirstError() {
  const el = document.querySelector('.input.error, .textarea.error, .select.error');
  if (el) el.focus();
}

// Printable daily schedule for one doctor (staff print the day's patient
// list for doctors who are not at a workstation). The HTML is rendered into
// a hidden print iframe — the browser's print dialog then offers
// "Save as PDF" as the destination.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDoctorScheduleHTML(doctor, appts, dateStr) {
  const count = (s) => appts.filter(a => a.status === s).length;
  const rows = appts.length ? appts.map((a, i) => {
    const pName = a.patient?.full_name || a.booked_for || 'Unknown patient';
    const pEmail = a.patient?.email || '—';
    return `<tr>
      <td class="c-num">${i + 1}</td>
      <td class="c-time"><strong>${esc((a.start_time || '').slice(0, 5))}</strong></td>
      <td class="c-patient"><strong>${esc(pName)}</strong><span class="sub">${esc(pEmail)}</span></td>
      <td>${esc(a.reason || '—')}</td>
      <td>${esc((statusMeta(a.status) || {}).label || a.status)}</td>
    </tr>`;
  }).join('') : '<tr class="empty"><td colspan="5">No appointments scheduled for this day.</td></tr>';
  const stamp = `${formatDate(localToday())} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  const docName = doctor.full_name || 'Doctor';
  const specialty = doctor.specialties?.name || doctor.specialty_name || '';
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Dr. ${esc(docName.replace(/^Dr\.\s*/, ''))} — schedule ${esc(formatDate(dateStr))}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #000000; background: #ffffff; font-size: 12px; margin: 0; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 10px; }
  .brand { margin: 0 0 3px; font-size: 21px; font-weight: 700; letter-spacing: .3px; }
  .doc-label { margin: 0 0 4px; text-align: right; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; }
  .doc-time { margin: 0; text-align: right; color: #000000; font-size: 10px; }
  .doctor-block { display: flex; justify-content: space-between; align-items: center; margin: 18px 0 2px; }
  .doc-name { margin: 0; font-size: 16px; font-weight: 700; }
  .doc-sub { margin: 3px 0 0; color: #000000; font-size: 11px; }
  .date-line { margin: 0 0 14px; font-size: 12.5px; font-weight: 600; }
  .summary { display: flex; gap: 8px; margin: 0 0 14px; }
  .stat { flex: 1; border: 1px solid #000000; border-radius: 6px; padding: 7px 10px; }
  .stat .n { display: block; font-size: 17px; font-weight: 700; line-height: 1.2; }
  .stat .l { font-size: 9.5px; text-transform: uppercase; letter-spacing: .6px; }
  table { border-collapse: collapse; width: 100%; font-size: 11.5px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; padding: 6px 9px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; border-bottom: 2px solid #000000; }
  td { padding: 8px 9px; border-bottom: 1px solid #000000; vertical-align: top; }
  .c-num { width: 22px; }
  .c-time { white-space: nowrap; width: 72px; }
  .c-patient .sub { display: block; font-size: 10px; margin-top: 1px; }
  .empty td { text-align: center; padding: 24px; color: #666; }
</style>
</head>
<body>
  <div class="letterhead">
    <div>
      <p class="brand">MedicaCare</p>
    </div>
    <div>
      <p class="doc-label">Daily Schedule</p>
      <p class="doc-time">${esc(stamp)}</p>
    </div>
  </div>
  <div class="doctor-block">
    <div>
      <p class="doc-name">${esc(docName)}</p>
      <p class="doc-sub">${esc(specialty)}${doctor.room ? ` · ${esc(doctor.room)}` : ''}</p>
    </div>
  </div>
  <p class="date-line">${esc(formatDate(dateStr))}</p>
  <div class="summary">
    <div class="stat"><span class="n">${appts.length}</span><span class="l">Total</span></div>
    <div class="stat"><span class="n">${count('confirmed')}</span><span class="l">Confirmed</span></div>
    <div class="stat"><span class="n">${count('pending')}</span><span class="l">Pending</span></div>
    <div class="stat"><span class="n">${count('completed')}</span><span class="l">Completed</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function printDoctorSchedule(doctor, appts, dateStr) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  const cleanup = () => setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 300);
  frame.addEventListener('load', () => {
    try {
      const win = frame.contentWindow;
      win.addEventListener('afterprint', cleanup);
      win.focus();
      setTimeout(() => win.print(), 200);
    } catch { cleanup(); }
  });
  frame.srcdoc = buildDoctorScheduleHTML(doctor, appts, dateStr);
  document.body.appendChild(frame);
  setTimeout(cleanup, 600000);
}

export { csvCell, downloadCSV, buildDoctorScheduleHTML, printDoctorSchedule, localToday, focusFirstError };
