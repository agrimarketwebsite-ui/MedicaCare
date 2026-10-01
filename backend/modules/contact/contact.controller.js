// backend/modules/contact/contact.controller.js
// Phase 3 — POST /api/contact.

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { created } from '../../shared/utils/apiResponse.js';
import * as service from './contact.service.js';

export const submitContact = asyncHandler(async (req, res) => {
  const data = await service.submitContact(req.validated.body);
  return created(res, data);
});

export default { submitContact };
