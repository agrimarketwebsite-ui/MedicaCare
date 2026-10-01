// backend/modules/settings/setting.repository.js
// Phase 3 — public clinic info + appointment preferences (read-only).
// Ang dalawang tables ay SINGLETON rows (id = 1).

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[setting.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

/** Clinic identity — ang binabasa ng public pages (footer, Contact, clinic hours). */
export async function getClinicInfo() {
  const { data, error } = await supabase
    .from('clinic_info')
    .select('name, short_name, tagline, phone, email, address, hours')
    .eq('id', 1)
    .maybeSingle();
  return must({ data, error }, 'getClinicInfo');
}

/** Public subset ng app_settings — operational flags lang, walang secrets. */
export async function getPublicPreferences() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('auto_confirm_appointments, slot_interval_minutes, email_admins_on_new_appointment, remind_patients')
    .eq('id', 1)
    .maybeSingle();
  return must({ data, error }, 'getPublicPreferences');
}

export default { getClinicInfo, getPublicPreferences };
