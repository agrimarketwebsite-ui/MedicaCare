// backend/modules/admin/admin.routes.js
// Phase 6 — Admin Console composer: lahat ng admin sub-routers ay naka-mount
// dito. Ang requireAuth + requireRole('admin') ay INAAPLAY NANG ISANG BESES
// sa composer level (hindi na kailangang ulitin sa bawat sub-router).

import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import adminPatientRoutes from '../adminPatients/adminPatient.routes.js';
import adminDoctorRoutes from '../adminDoctors/adminDoctor.routes.js';
import adminAppointmentRoutes from '../adminAppointments/adminAppointment.routes.js';
import adminRecordRoutes from '../adminRecords/adminRecord.routes.js';
import adminStoryRoutes from '../adminStories/adminStory.routes.js';
import adminTicketRoutes from '../adminTickets/adminTicket.routes.js';
import adminContactRoutes from '../adminContact/adminContact.routes.js';
import adminSettingRoutes from '../adminSettings/adminSetting.routes.js';
import adminActivityRoutes from '../adminActivity/adminActivity.routes.js';
import adminReportRoutes from '../adminReports/adminReport.routes.js';
import adminNotificationRoutes from '../adminNotifications/adminNotification.routes.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.use('/patients', adminPatientRoutes);
router.use('/doctors', adminDoctorRoutes);
router.use('/appointments', adminAppointmentRoutes);
router.use('/records', adminRecordRoutes);
router.use('/stories', adminStoryRoutes);
router.use('/tickets', adminTicketRoutes);
router.use('/contact', adminContactRoutes);
router.use('/settings', adminSettingRoutes);
router.use('/activity', adminActivityRoutes);
router.use('/reports', adminReportRoutes);
router.use('/notifications', adminNotificationRoutes);

export default router;
