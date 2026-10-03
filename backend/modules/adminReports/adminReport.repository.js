// backend/modules/adminReports/adminReport.repository.js
// Phase 6 — Admin Console: reports persistence (read-only, computed queries
// — walang kailangang extra table).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminReport.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

/** Head-count para sa isang table, may optional na filters (array ng [col, op, value]). */
export async function countRows(table, filters = []) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  for (const [col, op, value] of filters) {
    query = query[op](col, value);
  }
  const { error, count } = await query;
  must({ data: null, error }, `countRows(${table})`);
  return count ?? 0;
}

export async function listSpecialties() {
  const { data, error } = await supabase.from('specialties').select('id, name').order('name');
  return must({ data, error }, 'listSpecialties');
}

export async function listDoctorsWithSpecialty() {
  const { data, error } = await supabase.from('doctors').select('id, full_name, specialty_id, specialties(name)');
  return must({ data, error }, 'listDoctorsWithSpecialty');
}

/** Bilang ng appointments kada araw sa huling 7 araw (Manila) — pang-dashboard chart. */
export async function countAppointmentsByDay() {
  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_date')
    .gte('appointment_date', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  must({ data, error }, 'countAppointmentsByDay');
  const counts = new Map();
  for (const r of data || []) counts.set(r.appointment_date, (counts.get(r.appointment_date) || 0) + 1);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push({ date: d, label: d.slice(5), value: counts.get(d) || 0 });
  }
  return days;
}

/** doctor_id ng lahat ng appointments (para sa specialty/busiest aggregations). */
export async function listAppointmentDoctorIds() {
  const { data, error } = await supabase.from('appointments').select('id, doctor_id');
  return must({ data, error }, 'listAppointmentDoctorIds');
}

/** Full appointment rows para sa CSV export (may optional filters). */
export async function listAppointmentsForExport({ status, from, to, doctorId } = {}) {
  let query = supabase
    .from('appointments')
    .select(
      'reference_code, appointment_date, start_time, end_time, reason, booked_for, status, ' +
        'patients(full_name), doctors(full_name, specialties(name))',
    );
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('appointment_date', from);
  if (to) query = query.lte('appointment_date', to);
  if (doctorId) query = query.eq('doctor_id', doctorId);
  const { data, error } = await query
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(5000);
  return must({ data, error }, 'listAppointmentsForExport');
}

export default {
  countRows,
  countAppointmentsByDay,
  listSpecialties,
  listDoctorsWithSpecialty,
  listAppointmentDoctorIds,
  listAppointmentsForExport,
};
