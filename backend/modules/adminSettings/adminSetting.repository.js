// backend/modules/adminSettings/adminSetting.repository.js
// Phase 6 — Admin Console: clinic_info + app_settings singleton (id=1)
// persistence. Ang read ay ginagamit din ng frontend admin settings page.

import { supabase } from '../../config/db.js';

function must(result, context) {
  if (result.error) {
    console.error(`[adminSetting.repository] ${context}:`, result.error.message);
    throw new Error(`Database error (${context})`);
  }
  return result.data;
}

const CLINIC_COLS = 'id, name, short_name, tagline, phone, email, address, hours';
const APP_COLS = 'id, auto_confirm_appointments, slot_interval_minutes, email_admins_on_new_appointment, remind_patients';

export async function getClinicInfo() {
  const { data, error } = await supabase
    .from('clinic_info')
    .select(CLINIC_COLS)
    .eq('id', 1)
    .maybeSingle();
  return must({ data, error }, 'getClinicInfo');
}

export async function updateClinicInfo(patch) {
  const { data, error } = await supabase
    .from('clinic_info')
    .update(patch)
    .eq('id', 1)
    .select(CLINIC_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateClinicInfo');
}

export async function getAppSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select(APP_COLS)
    .eq('id', 1)
    .maybeSingle();
  return must({ data, error }, 'getAppSettings');
}

export async function updateAppSettings(patch) {
  const { data, error } = await supabase
    .from('app_settings')
    .update(patch)
    .eq('id', 1)
    .select(APP_COLS)
    .maybeSingle();
  return must({ data, error }, 'updateAppSettings');
}

export default {
  getClinicInfo,
  updateClinicInfo,
  getAppSettings,
  updateAppSettings,
};
