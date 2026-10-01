// backend/modules/settings/setting.service.js
// Phase 3 — pinagsasama ang clinic_info + public app_settings subset.
// Read-only, walang PII: ang clinic info ay TIER 3 plaintext by design
// (ENCRYPTION_DESIGN §1 — public business info).

import * as repo from './setting.repository.js';

export async function getPublicSettings() {
  const [clinic, preferences] = await Promise.all([
    repo.getClinicInfo(),
    repo.getPublicPreferences(),
  ]);
  return { clinic, preferences };
}

export default { getPublicSettings };
