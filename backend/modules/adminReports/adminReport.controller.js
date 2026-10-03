// backend/modules/adminReports/adminReport.controller.js
// Phase 6 — Admin Console: reports endpoints. Ang /export.csv ay nagbabalik
// ng text/csv (hindi JSON envelope — file download).

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok } from '../../shared/utils/apiResponse.js';
import * as service from './adminReport.service.js';

export const getStats = asyncHandler(async (req, res) => {
  const data = await service.getStats();
  return ok(res, data);
});

export const getAppointmentsBySpecialty = asyncHandler(async (req, res) => {
  const data = await service.getAppointmentsBySpecialty();
  return ok(res, data);
});

export const getBusiestDoctors = asyncHandler(async (req, res) => {
  const data = await service.getBusiestDoctors();
  return ok(res, data);
});

export const exportCsv = asyncHandler(async (req, res) => {
  const { status, from, to, doctor_id } = req.validated.query;
  const csv = await service.getAppointmentsCsv({ status, from, to, doctor_id });
  const filename = `medicacare-appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

export default {
  getStats,
  getAppointmentsBySpecialty,
  getBusiestDoctors,
  exportCsv,
};
