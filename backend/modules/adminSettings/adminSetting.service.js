// backend/modules/adminSettings/adminSetting.service.js
// Phase 6 — Admin Console: clinic info + appointment preferences business
// logic. Ang writes ay may activity_log write (settings change ay audit-
// worthy — hal. ang auto-confirm toggle na nakakaapekto sa booking behavior).

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import * as repo from './adminSetting.repository.js';

export async function getClinicInfo() {
  const clinic = await repo.getClinicInfo();
  if (!clinic) throw ApiError.notFound('Clinic info not found');
  return { clinic };
}

export async function updateClinicInfo(actor, patch) {
  const clinic = await repo.updateClinicInfo(patch);
  if (!clinic) throw ApiError.notFound('Clinic info not found');
  await logActivity(actor, 'settings.update_clinic', `Updated clinic info (${Object.keys(patch).join(', ')})`);
  return { clinic };
}

export async function getAppSettings() {
  const app = await repo.getAppSettings();
  if (!app) throw ApiError.notFound('App settings not found');
  return { app };
}

export async function updateAppSettings(actor, patch) {
  const app = await repo.updateAppSettings(patch);
  if (!app) throw ApiError.notFound('App settings not found');
  await logActivity(actor, 'settings.update_app', `Updated app settings (${Object.keys(patch).join(', ')})`);
  return { app };
}

export default {
  getClinicInfo,
  updateClinicInfo,
  getAppSettings,
  updateAppSettings,
};
