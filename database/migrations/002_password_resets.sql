-- database/migrations/002_password_resets.sql
-- Phase 2 — Auth module (docs/INTEGRATION_ROADMAP.md).
--
-- BACKEND-OWNED table (hindi clinic domain) — HIWALAY sa database/schema.sql,
-- kasama ng 001_refresh_tokens.sql sa database/migrations/.
--
-- Bakit kailangan: ang POST /api/auth/forgot-password ay nagge-generate ng
-- reset token NGAYON (Phase 2); ang email send ay ia-attach sa Phase 8 (Brevo).
-- Ang token ay kailangang ma-store nang hash-only + single-use + may expiry —
-- hindi pwedeng "generate lang" nang walang persistence.
--
-- Paano i-apply (Supabase): SQL Editor → i-paste ang buong file → Run.
-- Idempotent: IF NOT EXISTS — ligtas i-run nang paulit-ulit.
--
-- Security semantics (ASVS V2.5/V6.2):
--   - `token_hash` lang ang naka-store (HMAC-SHA256 via crypto.js `hashToken`)
--     — hindi ang raw token. Ang raw token ay nasa reset link lang
--     (mai-email sa Phase 8).
--   - Single-use: `used_at` — kapag nagamit na, hindi na pwedeng gamitin ulit.
--   - TTL 1 oras (`expires_at`) — maikling window para sa reset link.
--   - Pagkatapos ng successful reset: ang auth.service ay nire-revoke LAHAT
--     ng refresh sessions ng account (muling mag-login sa lahat ng device).

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  -- Aling account source (patients | admins | doctor_accounts).
  -- Walang FK: depende sa account_kind kung saang table tumutukoy ang id.
  account_kind text not null check (account_kind in ('patient', 'admin', 'doctor')),
  account_id uuid not null,
  -- HMAC-SHA256 hex ng raw reset token — HINDI naka-store ang raw value.
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz, -- null = hindi pa nagamit; may value = nagamit na (single-use)
  created_at timestamptz not null default now()
);

-- Lookup: lahat ng reset requests ng isang account (audit/cleanup).
create index if not exists idx_password_resets_account
  on password_resets (account_kind, account_id);

-- Lookup: token hash → row (bawat POST /api/auth/reset-password).
-- UNIQUE: ang hash ay galing sa CSPRNG token; uniqueness = pananggalang sa bug.
create unique index if not exists uq_password_resets_hash
  on password_resets (token_hash);

-- Cleanup sweep: expired/used rows.
create index if not exists idx_password_resets_expires
  on password_resets (expires_at);

-- Panlinis ng lumang rows (opsyonal, kapag may cleanup job na):
--   delete from password_resets where used_at < now() - interval '7 days';
--   delete from password_resets where expires_at < now() - interval '7 days';

-- RLS: naka-comment by design — ang backend ay service_role (RLS bypass);
-- ang authorization ay nasa auth middleware/service layer (tugma sa 001).
-- alter table password_resets enable row level security;

comment on table password_resets is
  'Phase 2: backend-owned password-reset token store (hash-only, single-use, 1h TTL). Email send sa Phase 8.';
comment on column password_resets.token_hash is
  'HMAC-SHA256 hex ng raw reset token — HINDI naka-store ang raw value (ASVS V6.2).';
