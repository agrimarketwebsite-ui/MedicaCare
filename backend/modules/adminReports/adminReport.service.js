// backend/modules/adminReports/adminReport.service.js
// Phase 6 — Admin Console: reports business logic.
// - /stats: counts (patients/doctors/appointments/today/pending-stories/open-tickets)
// - /specialties: per-specialty appointment counts
// - /busiest-doctors: top 10 by appointment count
// - /export.csv: appointments CSV na may formula-injection guard
//   (ang cell na nagsisimula sa =, +, -, @ ay pinipre-fixan ng `'`).

import { manilaToday } from '../../shared/utils/manilaTime.js';
import { decryptRow } from '../patients/patient.service.js';
import * as repo from './adminReport.repository.js';

export async function getStats() {
  const [patients, doctors, appointments, appointments_today, pending_stories, open_tickets, byDay] =
    await Promise.all([
      repo.countRows('patients'),
      repo.countRows('doctors'),
      repo.countRows('appointments'),
      repo.countRows('appointments', [['appointment_date', 'eq', manilaToday()]]),
      repo.countRows('patient_stories', [['status', 'eq', 'pending']]),
      repo.countRows('support_tickets', [['status', 'eq', 'open']]),
      repo.countAppointmentsByDay(),
    ]);
  return {
    stats: { patients, doctors, appointments, appointments_today, pending_stories, open_tickets },
    byDay: byDay.map(({ label, value }) => ({ label, value })),
  };
}

export async function getAppointmentsBySpecialty() {
  const [specialties, doctors, appointments] = await Promise.all([
    repo.listSpecialties(),
    repo.listDoctorsWithSpecialty(),
    repo.listAppointmentDoctorIds(),
  ]);
  const doctorToSpecialty = new Map(doctors.map((d) => [d.id, d.specialty_id]));
  const counts = new Map();
  for (const appt of appointments) {
    const specId = doctorToSpecialty.get(appt.doctor_id);
    if (!specId) continue;
    counts.set(specId, (counts.get(specId) ?? 0) + 1);
  }
  return {
    specialties: specialties.map((s) => ({
      specialty_id: s.id,
      specialty_name: s.name,
      appointment_count: counts.get(s.id) ?? 0,
    })),
  };
}

export async function getBusiestDoctors() {
  const [doctors, appointments] = await Promise.all([
    repo.listDoctorsWithSpecialty(),
    repo.listAppointmentDoctorIds(),
  ]);
  const counts = new Map();
  for (const appt of appointments) {
    counts.set(appt.doctor_id, (counts.get(appt.doctor_id) ?? 0) + 1);
  }
  const rows = doctors
    .map((d) => ({
      doctor_id: d.id,
      full_name: d.full_name,
      specialty_name: d.specialties?.name ?? null,
      appointment_count: counts.get(d.id) ?? 0,
    }))
    .sort((a, b) => b.appointment_count - a.appointment_count)
    .slice(0, 10);
  return { doctors: rows };
}

// ---- CSV export ----

/**
 * Formula-injection guard: ang cell na nagsisimula sa =, +, -, @ (na
 * pwedeng maging spreadsheet formula) ay pinipre-fixan ng single quote.
 */
export function guardCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const guarded = guardCell(value);
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export async function getAppointmentsCsv({ status, from, to, doctor_id } = {}) {
  const rows = await repo.listAppointmentsForExport({
    status,
    from,
    to,
    doctorId: doctor_id,
  });
  const header = [
    'reference_code',
    'appointment_date',
    'start_time',
    'end_time',
    'patient_name',
    'doctor_name',
    'specialty_name',
    'status',
    'booked_for',
    'reason',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    const decrypted = decryptRow({ reason: row.reason }, ['reason']);
    lines.push(
      [
        row.reference_code,
        row.appointment_date,
        row.start_time,
        row.end_time,
        row.patients?.full_name ?? '',
        row.doctors?.full_name ?? '',
        row.doctors?.specialties?.name ?? '',
        row.status,
        row.booked_for ?? '',
        decrypted.reason ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

export default {
  getStats,
  getAppointmentsBySpecialty,
  getBusiestDoctors,
  getAppointmentsCsv,
  guardCell,
};
