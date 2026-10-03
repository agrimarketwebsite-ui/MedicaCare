// backend/modules/adminTickets/adminTicket.controller.js
// Phase 6 — Admin Console: support ticket endpoints. Ang actor (admin email)
// ay nire-resolve nang isang beses bawat request para sa activity_log; ang
// reply ay kailangan din ng admin full_name (author_name ng staff message).

import asyncHandler from '../../shared/utils/asyncHandler.js';
import { ok, created } from '../../shared/utils/apiResponse.js';
import { actorInfo } from '../../shared/utils/activityLog.js';
import * as service from './adminTicket.service.js';

export const listTickets = asyncHandler(async (req, res) => {
  const data = await service.listTickets({ status: req.validated.query.status });
  return ok(res, data);
});

export const getTicket = asyncHandler(async (req, res) => {
  const data = await service.getTicket(req.validated.params.id);
  return ok(res, data);
});

export const replyToTicket = asyncHandler(async (req, res) => {
  const actor = await actorInfo(req.user.id);
  const data = await service.replyToTicket(actor.email, actor.full_name, req.validated.params.id, req.validated.body);
  return created(res, data);
});

export const resolveTicket = asyncHandler(async (req, res) => {
  const actor = await actorInfo(req.user.id);
  const data = await service.resolveTicket(actor.email, req.validated.params.id);
  return ok(res, data);
});

export default {
  listTickets,
  getTicket,
  replyToTicket,
  resolveTicket,
};
