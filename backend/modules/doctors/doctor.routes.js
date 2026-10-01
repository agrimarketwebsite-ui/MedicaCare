// backend/modules/doctors/doctor.routes.js
// Phase 3 — public, read-only. TANDAAN ang order: ang `/specialties` ay
// naka-register BAGO ang `/:id` (kung hindi, ang "specialties" ay huhulihin
// ng :id param at magiging 400).

import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { listDoctorsQuerySchema, doctorIdParamSchema } from './doctor.validation.js';
import * as controller from './doctor.controller.js';

const router = Router();

router.get('/specialties', controller.listSpecialties);
router.get('/', validate({ query: listDoctorsQuerySchema }), controller.listDoctors);
router.get('/:id', validate({ params: doctorIdParamSchema }), controller.getDoctorById);

export default router;
