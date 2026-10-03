// backend/modules/adminActivity/adminActivity.service.js
// Phase 6 — Admin Console: audit trail read business logic (passthrough).

import * as repo from './adminActivity.repository.js';

export async function listActivity({ actor, action, from, to, page, limit }) {
  const { rows, total } = await repo.listActivity({ actor, action, from, to, page, limit });
  return { entries: rows, total, page, limit };
}

export default {
  listActivity,
};
