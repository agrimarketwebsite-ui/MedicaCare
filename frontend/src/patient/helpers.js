// Shared helpers/constants — patient (split from screens-patient.jsx)
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Icon, navigate, useHashRoute, useStore, StoreProvider,
  Sidebar, Topbar, AppShell, PublicNav, PageHeader,
  Badge, StatusBadge, DoctorStatusBadge, DoctorAvatar, PatientAvatar,
  Modal, ToastLayer, Field, TextInput, TextArea, SelectInput,
  Pagination, SkeletonRows, SortableTh, PageSpinner, EmptyState, ErrorState, ConfirmModal, MiniBarChart, DoctorRatingPill, PwField,
} from '../shared/components.jsx';
import {
  HOSPITAL, SPECIALTIES, DOCTORS, PATIENTS, CURRENT_PATIENT, CURRENT_ADMIN,
  APPOINTMENTS, AVAILABILITY_TEMPLATE,
  findDoctor, findPatient, formatDate, formatDateLong, initials, statusMeta, doctorStatusMeta,
  isSlotTaken, getSlotsFor, slotFitsInterval, downloadFile, isClinicDay, timeValue,
  // Shared hardened esc() — escapes <>& plus quotes so the printed/exported
  // documents stay safe even where a value lands in an attribute (MEDIUM-002)
  escapeHTML as esc,
} from '../shared/data.js';
import { CARE_GUIDE } from '../public/content.js';

// Keyboard support for clickable card containers (guidelines 20 & 36):
// elements exposing role="button" must activate on Enter/Space. The
// e.target check keeps nested buttons (e.g. "Book" inside a doctor card)
// from also triggering the card-level action.
function activateOnKey(action) {
  return (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      action();
    }
  };
}

// §46.7: after inline validation fails, move focus to the first invalid
// field so keyboard and screen-reader users land straight on what needs
// fixing. The shared TextInput/TextArea/SelectInput carry an .error class
// whenever their error prop is set.
function focusFirstError() {
  const el = document.querySelector('.input.error, .textarea.error, .select.error');
  if (el) el.focus();
}

// §50 URL state: reflect list state (filters/search/page) in the URL so it
// survives a refresh and can be deep-linked/shared. history.replaceState
// keeps the back button clean — only real navigation goes into history.
function syncListParams(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${window.location.pathname}${window.location.search}#${path}${qs ? '?' + qs : ''}`;
  window.history.replaceState(null, '', url);
}

// "2026-09-11" + "10:30 AM" → ICS timestamp "20260911T103000" (floating local time)
function toICSStamp(dateStr, timeStr, addMinutes = 0) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let h = 9, min = 0;
  if (m) {
    h = (parseInt(m[1], 10) % 12) + (/pm/i.test(m[3]) ? 12 : 0);
    min = parseInt(m[2], 10);
  }
  const dt = new Date(dateStr + 'T00:00:00');
  dt.setHours(h, min + addMinutes, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

// .ics (iCalendar) content so the appointment can be imported into any calendar app
// Phase 4: optional durationMinutes (galing sa API end_time/start_time);
// default 30 para sa legacy shape na walang duration.
function buildICS(appt, doctor, durationMinutes = 30) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedicaCare//Patient Portal//EN',
    'BEGIN:VEVENT',
    `UID:${appt.id}@medicacare.ph`,
    `DTSTAMP:${toICSStamp(appt.date, appt.time)}`,
    `DTSTART:${toICSStamp(appt.date, appt.time)}`,
    `DTEND:${toICSStamp(appt.date, appt.time, durationMinutes)}`,
    `SUMMARY:${doctor.name} (${doctor.specialty})`,
    `LOCATION:${doctor.room}, MedicaCare`,
    `DESCRIPTION:Appointment ${appt.id.toUpperCase()}: ${String(appt.reason).replace(/\r?\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// Simple printable HTML receipt
function buildReceipt(appt, doctor, patient) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Receipt ${esc(appt.id.toUpperCase())} at MedicaCare</title></head>
<body style="font-family: Arial, sans-serif; max-width: 560px; margin: 40px auto; color: #1e293b;">
  <h2 style="margin: 0;">MedicaCare</h2>
  <p style="margin: 4px 0 20px; color: #64748b;">221 Rizal Avenue, Quezon City · +63 (2) 8567 4400</p>
  <h3 style="border-top: 1px solid #e2e8f0; padding-top: 16px;">Appointment receipt</h3>
  <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
    <tr><td style="padding: 6px 0; color: #64748b;">Reference number</td><td style="text-align: right;"><strong>${esc(appt.id.toUpperCase())}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #64748b;">Patient</td><td style="text-align: right;">${esc(patient.name)}</td></tr>
    <tr><td style="padding: 6px 0; color: #64748b;">Doctor</td><td style="text-align: right;">${esc(doctor.name)} (${esc(doctor.specialty)})</td></tr>
    <tr><td style="padding: 6px 0; color: #64748b;">Date &amp; time</td><td style="text-align: right;">${esc(window.formatDateLong(appt.date))}, ${esc(appt.time)}</td></tr>
    <tr><td style="padding: 6px 0; color: #64748b;">Location</td><td style="text-align: right;">${esc(doctor.room)}</td></tr>
    <tr><td style="padding: 6px 0; color: #64748b;">Reason for visit</td><td style="text-align: right;">${esc(appt.reason)}</td></tr>
    <tr><td style="padding: 6px 0; color: #64748b;">Status</td><td style="text-align: right;">${esc((window.statusMeta(appt.status) || {}).label || appt.status)}</td></tr>
    <tr><td style="padding: 12px 0; border-top: 1px solid #e2e8f0;"><strong>Consultation fee</strong></td><td style="text-align: right; border-top: 1px solid #e2e8f0;"><strong>&#8369;${Number(doctor.fee).toLocaleString()}</strong></td></tr>
  </table>
  <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Prototype receipt: fictional data for demo purposes only.</p>
</body>
</html>`;
}

// Local (not UTC) YYYY-MM-DD so "today" matches the user's timezone
function localToday() {
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// ============================================================
// Phase 4 — API-shape helpers (patient portal ↔ backend contract)
// ============================================================

// "HH:MM:SS" (24h, galing sa API) → "HH:MM" para sa POST bodies
function time24(hhmmss) {
  return String(hhmmss || '').slice(0, 5);
}

// "HH:MM:SS" (24h) → "h:mm AM/PM" para sa display (tugma sa dating UI copy)
function fmtTime12(hhmmss) {
  const m = String(hhmmss || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(hhmmss || '—');
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

// Next N days bilang YYYY-MM-DD (local), para sa date pickers
function nextDays(n) {
  const out = [];
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// GET /api/appointments(:id) shape → frontend shape na ginagamit ng mga
// patient page. Ang API ay nagbabalik ng appointment_date/start_time
// ("HH:MM:SS")/reference_code/booked_for at nested doctor
// { id, full_name, specialty_name }.
function toFrontendAppt(a) {
  if (!a) return null;
  return {
    id: a.id,
    reference: a.reference_code,
    doctorId: a.doctor?.id,
    doctorName: a.doctor?.full_name || 'Unknown doctor',
    specialty: a.doctor?.specialty_name || '—',
    doctorRoom: a.doctor?.room,
    doctorFee: a.doctor?.consultation_fee,
    date: a.appointment_date,
    time: time24(a.start_time),
    timeDisplay: fmtTime12(a.start_time),
    endTime: a.end_time ? time24(a.end_time) : '',
    duration: a.duration_minutes,
    status: a.status,
    reason: a.reason,
    bookedFor: a.booked_for,
    contact: a.contact_number,
    additionalNotes: a.additional_notes,
    isFirstVisit: a.is_first_visit,
    familyMemberId: a.family_member_id,
    createdAt: a.created_at,
    statusHistory: a.status_history || [],
  };
}

// Numeric minutes para sa "HH:MM" slot strings — ang timeValue() sa data.js
// ay para sa "h:mm AM/PM" format, hindi 24h
function time24Value(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Printable full medical summary (visit records + medications + lab results +
// billing) — downloaded from the Medical Records page as a print-friendly HTML
// file the browser can "Save as PDF". Same pattern as the appointment receipt;
// addresses the privacy page's "you may request a copy of your records" right.
function buildRecordsHTML(patient, records, meds, labs, bills) {
  const row = (label, value) => `<tr><td class="l">${esc(label)}</td><td>${esc(value)}</td></tr>`;
  const recordRows = records.map(r =>
    `<tr><td>${esc(window.formatDate(r.date))}</td><td>${esc((window.findDoctor(r.doctorId) || {}).name || '—')}</td><td>${esc(r.title)}</td><td>${esc(r.summary)}</td></tr>`).join('');
  const medRows = meds.map(m =>
    `<tr><td><strong>${esc(m.name)}</strong></td><td>${esc(m.dose)} · ${esc(m.form)}</td><td>${esc(m.frequency)}</td><td>${esc((window.findDoctor(m.prescriberId) || {}).name || '—')}</td><td>${esc(m.status)}</td></tr>`).join('');
  const labBlocks = labs.map(l =>
    `<h3>${esc(l.name)} — ${esc(window.formatDate(l.date))} <span class="muted">(${esc(l.category)})</span></h3>
    <table>${l.results.map(r => `<tr><td class="l">${esc(r.item)}</td><td${r.flag ? ' class="flag"' : ''}><strong>${esc(r.value)} ${esc(r.unit)}</strong>${r.flag ? ` <span class="flagchip">${esc(r.flag.toUpperCase())}</span>` : ''}</td><td class="muted">${esc(r.range)}</td></tr>`).join('')}</table>`).join('');
  const billRows = bills.map(b =>
    `<tr><td>${esc(window.formatDate(b.date))}</td><td>${esc(b.service)}</td><td>${esc(b.doctor)}</td><td>₱${Number(b.amount).toLocaleString()}</td><td>${esc(b.status)}</td></tr>`).join('');
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Medical records — ${esc(patient.name)} · MedicaCare</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; max-width: 720px; margin: 40px auto; font-size: 13px; line-height: 1.55; }
  h1 { margin: 0; font-size: 22px; }
  .head { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 6px; }
  .muted { color: #64748b; font-weight: 400; }
  h2 { font-size: 14px; margin: 24px 0 6px; text-transform: uppercase; letter-spacing: .06em; }
  h3 { font-size: 13px; margin: 14px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0 10px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.l { color: #64748b; width: 180px; }
  td.flag { color: #b91c1c; }
  .flagchip { background: #fef2f2; color: #b91c1c; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; }
  .foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="head">
    <h1>MedicaCare</h1>
    <div class="muted">221 Rizal Avenue, Quezon City · +63 (2) 8567 4400 · care@medicacare.ph</div>
  </div>
  <h2>Patient</h2>
  <table>
    ${row('Name', patient.name)}
    ${row('Date of birth', patient.dob || '—')}
    ${row('Blood type', patient.bloodType || '—')}
    ${row('Known allergies', patient.allergies || 'None')}
    ${row('Emergency contact', patient.emergencyContact || '—')}
  </table>
  <h2>Visit records</h2>
  ${recordRows ? `<table><tr><td class="l">Date</td><td class="l">Doctor</td><td class="l">Reason for visit</td><td>Notes</td></tr>${recordRows}</table>` : '<p class="muted">No completed visits yet.</p>'}
  <h2>Medications</h2>
  ${medRows ? `<table><tr><td class="l">Medicine</td><td class="l">Dose / form</td><td class="l">Frequency</td><td class="l">Prescriber</td><td>Status</td></tr>${medRows}</table>` : '<p class="muted">No medications on file.</p>'}
  <h2>Lab results</h2>
  ${labBlocks || '<p class="muted">No lab results on file.</p>'}
  <h2>Billing summary</h2>
  ${billRows ? `<table><tr><td class="l">Date</td><td class="l">Service</td><td class="l">Doctor</td><td class="l">Amount</td><td>Status</td></tr>${billRows}</table>` : '<p class="muted">No bills yet.</p>'}
  <p class="foot">Generated by the MedicaCare patient portal on ${esc(window.formatDateLong(localToday()))} · Prototype: fictional demo data — not a medical document.</p>
</body>
</html>`;
}


// ============================================================
// Patient screens
// ============================================================

export { activateOnKey, focusFirstError, syncListParams, toICSStamp, buildICS, buildReceipt, localToday, buildRecordsHTML, time24, fmtTime12, nextDays, toFrontendAppt, time24Value };

