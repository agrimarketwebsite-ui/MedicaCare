// backend/modules/adminNotifications/adminNotification.service.js
// Phase 6 — Admin Console: notification management business logic.
// Ang bawat create ay may activity_log write.

import ApiError from '../../shared/utils/ApiError.js';
import { logActivity } from '../../shared/utils/activityLog.js';
import { getPatientById } from '../patients/patient.repository.js';
import * as repo from './adminNotification.repository.js';

export async function listNotifications({ patient_id } = {}) {
  const notifications = await repo.listNotifications({ patientId: patient_id });
  return { notifications };
}

export async function createNotification(actor, input) {
  const { patient_id, appointment_id, type, title, message } = input;
  const patient = await getPatientById(patient_id);
  if (!patient) throw ApiError.notFound('Patient not found');
  const row = await repo.createNotification({
    patient_id,
    appointment_id: appointment_id ?? null,
    type,
    title,
    message,
  });
  await logActivity(actor, 'notification.create', `Sent "${type}" notification to ${patient.full_name} (${title})`);
  return { notification: row };
}

export default {
  listNotifications,
  createNotification,
};
