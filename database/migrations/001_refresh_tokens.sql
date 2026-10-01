-- database/migrations/001_refresh_tokens.sql
-- Phase 1 — Shared plumbing (docs/INTEGRATION_ROADMAP.md).
--
-- BACKEND-OWNED table ito (hindi clinic domain) — kaya HIWALAY sa
-- database/schema.sql, ayon sa docs/BACKEND_ARCHITECTURE.md §6.3.
-- I-apply sa IBABAW ng schema.sql (ang schema.sql ang singleton source of truth
-- ng 21 clinic tables; ang migration na ito ay idinadagdag lang).
--
-- Paano i-apply (Supabase):
--   1. Supabase dashboard → SQL Editor → New query
--   2. I-paste ang buong file na ito → Run
--   3. I-verify: Table Editor → dapat may `refresh_tokens` table na.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS, kaya
-- ligtas i-run nang paulit-ulit.
--
-- Security semantics (docs/BACKEND_SECURITY_AUDIT.md §3 shared/ + V6.2,
-- docs/ENCRYPTION_DESIGN.md hindi sakop — tokens ay HINDI PHI):
--   - `token_hash` lang ang naka-store — HINDI kailanman ang raw token value
--     (hash = HMAC-SHA256 via backend/shared/utils/crypto.js `hashToken()`).
--   - Refresh ROTATION: sa bawat successful refresh, ang lumang row ay
--     nire-revoke (revoked_at = now()) at may bagong row para sa bagong token.
--   - REUSE DETECTION: kapag may nag-present ng refresh token na ang hash ay
--     naka-revoked na, I-REVOKE LAHAT ng sessions ng account na iyon
--     (account_kind + account_id) — senyales ito ng token theft.
--     (I-implement sa backend/modules/auth/auth.service.js — Phase 2.)
--   - TTL: access 15m / refresh 7d — values nasa backend/.env
--     (JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN).
--   - Bcrypt cost ≥ 10 para sa password hashing (BACKEND_SECURITY_AUDIT V2.4)
--     — gagamitin sa auth.service (Phase 2); walang password code sa Phase 1.

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  -- Aling account source ang may-ari ng session. Walang FK: ang account_id ay
  -- tumutukoy sa patients | admins | doctor_accounts depende sa account_kind
  -- (role ay derived sa account source — BACKEND_ARCHITECTURE §6.1).
  account_kind text not null check (account_kind in ('patient', 'admin', 'doctor')),
  account_id uuid not null,
  -- HMAC-SHA256 hex ng raw refresh token. HINDI naka-store ang raw value —
  -- kapag na-dump ang DB, hindi magagamit ang hashes bilang session tokens.
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz, -- null = active; may value = ni-revoke (rotation/logout/reuse-detection)
  created_at timestamptz not null default now()
);

-- Lookup: lahat ng active sessions ng isang account (logout-all / reuse-detection sweep).
create index if not exists idx_refresh_tokens_account
  on refresh_tokens (account_kind, account_id);

-- Lookup: token hash → row (bawat /api/auth/refresh call). UNIQUE din ito —
-- ang hash ay galing sa CSPRNG token kaya collision ay hindi dapat mangyari;
-- ang uniqueness ay pananggalang laban sa logic bug.
create unique index if not exists uq_refresh_tokens_hash
  on refresh_tokens (token_hash);

-- Cleanup sweep: expired rows (jobs/cleanup — Phase 2+). Partial index para
-- ang sweep ay hindi nag-scan ng revoked/active rows.
create index if not exists idx_refresh_tokens_expires
  on refresh_tokens (expires_at)
  where revoked_at is null;

-- Panlinis ng lumang revoked rows (opsyonal, kapag may cleanup job na):
--   delete from refresh_tokens where revoked_at < now() - interval '30 days';
--   delete from refresh_tokens where expires_at < now() - interval '30 days';

-- Row Level Security: ang backend ay gumagamit ng service_role key (RLS bypass
-- — BACKEND_ARCHITECTURE §6.2), kaya ang authorization ay nasa
-- auth.middleware.requireRole() + service-level scoping, HINDI sa RLS.
-- Kung i-enable ang RLS dito nang walang policies, denied-by-default lahat
-- maliban sa service_role — ligtas na default. Naka-comment para tugma sa
-- "RLS mananatiling commented" na polisiya ng schema.sql.
-- alter table refresh_tokens enable row level security;
-- (walang policies = denied para sa anon/authenticated; service_role bypass.)

comment on table refresh_tokens is
  'Phase 1: backend-owned JWT refresh token store (hash-only). Rotation + reuse detection — tingnan ang header comments.';
comment on column refresh_tokens.token_hash is
  'HMAC-SHA256 hex ng raw refresh token — HINDI naka-store ang raw value (ASVS V6.2).';
comment on column refresh_tokens.revoked_at is
  'NULL = active. May value = ni-revoke via rotation, logout, o reuse-detection (Phase 2: auth.service).';
