# MedicaCare — Integration Roadmap (Frontend ↔ Backend ↔ Database)

> **Status:** LIVE reference — Phase 0 ✅ DONE, Phase 1 ✅ DONE (2026-10-01). Itong doc ang tala ng
> order ng paggawa para ma-wire ang buong stack nang maayos at secure.
> **Paano gamitin:** trabahuhin ang mga phase sa order. Bawat phase ay may
> **DB / Backend / Frontend / Security / Acceptance** sections — i-checklist habang
> tinatapos. Huwag laktawan ang security section ng bawat phase.

**Companion docs (aligned sa roadmap na ito):**

| Doc | Gamit |
| --- | --- |
| `docs/BACKEND_ARCHITECTURE.md` | Module structure, layer rules, feature → module → table mapping |
| `docs/BACKEND_SECURITY_AUDIT.md` | Per-module security checklist (OWASP API Top 10 + ASVS) — basahin bago mag-code |
| `docs/DATABASE_SECURITY_AUDIT.md` | Schema security audit (21 tables, RLS playbook) |
| `docs/FRONTEND_SECURITY_AUDIT.md` | Client-side checklist (XSS, token storage, input handling) |
| `docs/ENCRYPTION_DESIGN.md` | TIER 1 [ENC] fields / TIER 2 blind index |
| `docs/STORAGE_DESIGN.md` | Avatars bucket + signed URLs — Phase 7 |
| `docs/SECURITY_ALIGNMENT.md` | Cross-layer alignment (§H sessions, §J realtime) |
| `database/schema.sql` | Singleton source of truth ng schema (naka-apply na sa Supabase) |

---

## Phase 0 — Baseline ✅ DONE

- **Backend boot chain LIVE:** `config/env.js` (fail-fast validation), `config/db.js`
  (Supabase singleton), `config/cors.js` (strict allowlist), `config/logger.js` +
  `middleware/requestLogger.js`, `middleware/rateLimiter.js` (`apiLimiter` 300/15min +
  `authLimiter` 10/15min reserved), `middleware/errorHandler.js` + `notFound.js`,
  `shared/utils/` (ApiError, apiResponse, asyncHandler), `app.js` pipeline
  (helmet → CORS → body 1mb → log → limiter → routes), `server.js` (graceful shutdown).
- **Verified live:** `GET /api/health` → `200 {status:"ok", db:"ok"}` — Supabase
  reachable at naka-apply na ang schema (`specialties` table ang sumasagot).
- **Secrets:** real values nasa `backend/.env` (gitignored); `.env.example`
  placeholders lang; root `.gitignore` nag-iwas sa `.vite/` junk.
- **Frontend:** KUMPLETO ang UI sa lahat ng pages (public / patient / doctor /
  admin), hash routing na may route guards (`App.jsx`), store.jsx
  (localStorage-based sessions), `data.js` placeholders — **walang API calls pa**.
- **Tests/lint:** `npm run lint` = 0 errors; module tests ay stubs pa.

---

## Phase Order at a Glance

| # | Phase | Result |
| --- | --- | --- |
| 1 | Shared plumbing (API client + token session + `refresh_tokens`) | Nag-uusap na ang browser at API |
| 2 | **Auth module** (3 account sources) | Register/login/refresh/logout, role guards |
| 3 | Public content + directory | Landing/Doctors/Services/Contact — live data |
| 4 | Patient portal core (profile + appointments) | Booking end-to-end |
| 5 | Doctor portal | Schedule / complete-visit / notes / feedback |
| 6 | Admin console | Full CRUD + reports + audit trail |
| 7 | Storage (avatars) | Signed uploads, private bucket |
| 8 | Email + reminders (Brevo + cron) | Transactional emails, auto-reminders |
| 9 | Messaging + notifications (+ realtime) | Support loop, bell, live updates |
| 10 | Hardening + deployment | Vercel prod, full audit pass |

**Bakit ganito ang order (dependency logic):**
1. **Auth una** — lahat ng susunod na module ay may `requireRole()`; walang
   maitatayong secured endpoint nang walang session.
2. **Public content kasunod** — walang auth requirement, mabilis na win,
   at siyang nagpa-pattern ng "load data on mount" flow ng frontend.
3. **Patient flow bago doctor** — ang booking ang puso ng app; dito lumalabas
   ang slot logic (`fn_available_slots`) at PHI encryption.
4. **Doctor bago admin** — mas maliit; pagkatapos nito kumpleto na ang
   appointment lifecycle sa dalawang panig, kaya ang admin CRUD wave ay
   mekanikal na (reuse ng established patterns).
5. **Storage/email/realtime huli sa core** — bolt-on enhancements; hindi
   sila hadlang sa main clinic flows.

## Phase 1 — Shared Plumbing ✅ DONE (2026-10-01)

**Goal:** may gumaganang API client sa frontend at maayos na session/token
architecture bago pa ang unang secured endpoint.

### DB
- [x] Gumawa + i-apply ang `database/migrations/001_refresh_tokens.sql`
  (hiwalay sa `schema.sql` — backend-owned, hindi clinic domain, ayon sa
  BACKEND_ARCHITECTURE §6.3):
  `refresh_tokens(id uuid pk, account_kind text check in ('patient','admin','doctor'), account_id uuid, token_hash text, expires_at timestamptz, revoked_at timestamptz, created_at timestamptz default now())`
  + index sa `account_id` at `expires_at` (para sa cleanup sweep).
  ✅ File created (idempotent, may rotation/reuse semantics sa comments).
  ✅ Na-apply ng user sa Supabase SQL Editor (2026-10-01); verified sa Table Editor.
  Bonus (ayon sa DATABASE_SECURITY_AUDIT §3): UNIQUE index sa `token_hash`.
- [x] I-update ang `database/README.md` na may tala sa migration file.
  ✅ Nasa README na ang `migrations/` table + paano i-apply.

### Backend
- [x] `shared/utils/crypto.js` — gawin totoong code: HMAC-SHA256 token hashing
  (para sa refresh tokens) + AES-256-GCM encrypt/decrypt (para sa TIER 1 [ENC]
  fields, `docs/ENCRYPTION_DESIGN.md`) gamit ang `config.encryptionKey`.
  Kailangan na ito ng auth at muling gagamitin sa phases 4–5.
  ✅ Implemented: `encryptField`/`decryptField` (v1:iv:tag:ct, random 12-byte IV,
  tamper → generic throw), `hashToken`/`verifyTokenHash` (timing-safe),
  `blindIndex`, `isEncrypted`. `node --test tests/crypto.test.js` — 13/13 pass
  (roundtrip, tamper-reject, wrong-key-reject, blind-index equality).
- [x] `middleware/validate.js` — zod validation middleware (body/query/params
  → 400 na may safe `details`; integration ng zod schemas sa request chain).
  ✅ Implemented: `validate({body, query, params})` → parsed values sa
  `req.validated.*`; 400 na may `{path, message, code}` details, walang stack.
  `.strict()` ay nasa schema author (Phase 2+). `node --test
  tests/validate.test.js` — 6/6 pass.

### Frontend
- [x] **Bago:** `frontend/src/shared/api.js` — fetch wrapper:
  - base URL mula sa `import.meta.env.VITE_API_BASE_URL`;
  - i-unwrap ang `{success, data, meta}` envelope; error ay may `{status, message, code}`;
  - awtomatikong mag-attach ng `Authorization: Bearer <accessToken>`;
  - **401 → tahimik na refresh → isang retry**; kapag nabigo pa rin, logout;
  - network error → toast (`useStore().pushToast`).
  ✅ Implemented + verified laban sa mock server (9/9 tests): envelope unwrap,
  Bearer attach, 401 → single-flight silent refresh → isang retry, refresh-fail
  → clear + logout handler, ApiError {status, message, code, details},
  apiWithMeta, network-error toast, bootstrapSession, walang localStorage.
- [x] **Token storage decision (FRONTEND_SECURITY_AUDIT):**
  - **Access token: sa memory lang** (hindi localStorage — XSS-stealable).
    Nawawala sa refresh; okay lang dahil may silent refresh.
  - **Refresh token: httpOnly cookie** (`/api/auth/refresh` path scope,
    `SameSite=Lax`, `Secure` sa prod). Same-site ang localhost:5173 ↔
    localhost:3000 (ibang port lang) kaya gumagana ang Lax + `credentials: true`
    na naka-set na sa `config/cors.js`.
  ✅ Implemented sa api.js: access token = module-level memory variable lang
  (walang localStorage kahit saan sa file — verified); refresh = httpOnly
  cookie via `credentials: 'include'` sa lahat ng requests.
- [x] `store.jsx` — i-adapter ang sessions (`patientSession` / `adminSession` /
  `doctorSession`) → profile mula sa API response; token persistence sa
  localStorage ay tinatanggal (profile cache lang ang mananatili).
  ✅ Adapted: login*() ay tumatanggap na ng API profile (walang token);
  naka-wire ang `setNotify` → pushToast, `onUnauthorized` → logout lahat, at
  mount-time `bootstrapSession()` (silent refresh → applyApiSession by role).
  Ang login/logout API calls mismo ay Phase 2.

### Security checklist
- [x] Access TTL 15m / refresh 7d (values na sa `.env`); **refresh rotation**
  sa bawat refresh (luma → revoked); **reuse detection** (revoked token reused →
  i-revoke lahat ng sessions ng account).
  ✅ TTL values confirmed sa `backend/.env.example` (15m/7d — naka-validate ng
  `config/env.js`). Ang rotation + reuse-detection SEMANTICS ay naka-specify sa
  `001_refresh_tokens.sql` header at sinusuportahan ng `hashToken`/
  `verifyTokenHash`; ang enforcement ay nasa `auth.service` (Phase 2).
- [x] Bcrypt cost ≥ 10 (BACKEND_SECURITY_AUDIT V2.4).
  ✅ Walang password-hashing code sa Phase 1 (walang auth endpoints pa) —
  standing rule ito para sa Phase 2 `auth.service` (gagamit ng bcryptjs, cost 12).

### Acceptance
- [x] Mula sa browser console, `api.js` fetch sa `/api/health` ay tama ang
  envelope + CORS pasok.
  ✅ Verified live (2026-10-01): frontend :5173 at backend :3000 tumatakbo;
  ang cross-origin `POST /api/auth/refresh` ay nakabalik ng JSON 404 (hindi
  CORS error) — pumapasa ang CORS. Ang 404 mismo ay expected (auth endpoints
  ay Phase 2). Envelope unwrap logic: 9/9 api.js mock-server tests.
- [x] Ang `refresh_tokens` table ay nage-exist sa Supabase.
  ✅ Na-apply ng user sa Supabase SQL Editor; verified sa Table Editor.

---

## Phase 2 — Auth Module 🔑 (una sa modules) — ✅ TAPOS (verified live 2026-10-02)

**Goal:** tatlong account source (`patients` self-register, `admins`,
`doctor_accounts` admin-issued) — iisang JWT flow. Role claim ay derived sa
kung aling account source ang tumugma (BACKEND_ARCHITECTURE §6.1).

> **Phase 2 sign-off (2026-10-02):** lahat ng acceptance criteria ay verified
> live — `npm test` 59/59 sa user machine (laban sa tunay na Supabase), at ang
> browser flows (register/login/reload/admin/doctor/forgot/logout) ay green
> ayon sa backend logs. Mga natagpuang isyu sa verification at naayos: 429→500
> rate-limiter bug, doctor-login directory gate, PwField padding. Phase 2 ay
> sarado; susunod ay Phase 3.

### Backend (`modules/auth/*`)
- [x] `auth.validation.js` — zod: register (full_name, email, phone, password
  ≥8 + strength rule + common-password blocklist), login (optional `role`
  hint), forgot/reset password. `.strict()` lahat (V4.1 — walang role/hash injection).
- [x] `auth.repository.js` — lookup per account source (identity column ayon sa
  `schema.sql`), insert ng patient, token hash CRUD sa `refresh_tokens` +
  `password_resets`, best-effort `activity_log` audit.
- [x] `auth.service.js` — bcrypt cost 12 compare (timing-safe + dummy compare
  kapag unknown email), JWT issue (`sub` = account id, `role` =
  patient|admin|doctor derived sa source, iss/aud/exp verified), refresh
  **rotate + reuse detection** (revoked token reuse → revoke LAHAT ng sessions),
  logout revoke-all, forgot/reset (single-use, 1h TTL; reset → revoke all sessions).
- [x] `auth.middleware.js` — `requireAuth` (JWT verify) + `requireRole(...)`.
- [x] `auth.controller.js` + `auth.routes.js` — mount **`authLimiter`** sa lahat
  ng credential endpoints (register/login/refresh/forgot/reset); naka-mount sa
  `/api/auth` (routes/index.js). Refresh cookie: `mc_refresh`, httpOnly,
  SameSite=Lax, Secure sa prod, Path=`/api/auth/refresh`.
- [x] Error semantics: **generic na "Invalid email or password"** — hindi
  pwedeng manghula ang attacker kung alin ang mali (ASVS V2.5).
- [x] Forgot password: token generation ginawa na; ang email send ay
  ia-attach sa Phase 8 (Brevo). DEV-ONLY: sa non-prod ay nilo-log ang token
  para ma-test ang reset flow.
- [x] `shared/utils/tokens.js` (JWT issue/verify + `parseExpiresIn`) at
  `shared/utils/passwords.js` (bcrypt cost 12). `cookie-parser` dep + `npm test`
  script fix (`node --test tests/` ay hindi nagdi-discover ng files → ginawang
  `node --test "tests/*.test.js"`).
- [x] `database/migrations/002_password_resets.sql` — hash-only, single-use,
  1h TTL reset token store (kailangan para maging totoo ang "token generation
  ngayon"; idempotent, may README row).

**Phase 2 design decisions (documented):**
- **Logout = logout everywhere.** Ang refresh cookie ay Path=`/api/auth/refresh`
  lang, kaya hindi ito nakikita ng `/logout` — ang access-token identity ang
  ginagamit para i-revoke lahat ng sessions. Mas ligtas din (isang logout,
  lahat ng device).
- **`nmc.users` ay HINDI pa tuluyang tinatanggal** — ang Login/Register ay hindi
  na gumagamit nito, pero ang admin "grant doctor portal access" flow
  (DoctorFormModal → DoctorsMgmt) ay nakasandal pa rin dito hanggang sa Phase 6
  (admin console) kung saan ito ia-wire sa backend. Hanggang doon, ang admin-
  granted doctor accounts ay hindi makaka-login (API na ang DoctorLogin);
  gumagana ang seeded `doctor_accounts` rows.
- **Doctor directory bridge:** ang `DOCTORS` directory ay empty pa (Phase 5 pa
  ang doctors API) — kaya tinanggal ang `findDoctor` gate sa `DoctorLogin.jsx`
  (ang API ang source of truth ng account) at ang `App.jsx` guard ay gumagana
  lang kapag may laman ang directory. Ang portal ay nagpapakita ng "Unknown
  doctor" fallback (graceful, hindi crash) hanggang sa Phase 5.
- **PwField alignment fix:** ang `.input-group .input` CSS (padding-left:38px
  para sa left-icon inputs) ay maling naa-apply sa password field na walang
  left icon — ibinalik sa 12px.

### Frontend
- [x] `Login.jsx`, `Register.jsx` → API; **tinanggal ang localStorage account
  creation** at ang prototype OTP modal (walang email service hanggang Phase 8).
- [x] `AdminLogin.jsx` + `DoctorLogin.jsx` → parehong `/api/auth/login`, may
  `role:'admin'` / `role:'doctor'` hint; tama ang redirect at role.
- [x] Route guards sa `App.jsx` — walang code change na kailangan: ang guards ay
  nagbabasa na ng `store.patientSession/adminSession/doctorSession` na API-
  profile-based mula pa sa Phase 1.
- [x] `ForgotPassword.jsx` → POST `/api/auth/forgot-password`; laging "sent"
  UI (generic, walang enumeration).
- [x] `store.jsx` — ang tatlong logout ay tumatawag ng `POST /api/auth/logout`
  (best-effort) + `clearAccessToken()`.

### Security checklist
- [x] Passwords: never in logs, never sa response (kahit hash) — ang profile
  mappers ay explicit safe columns lang.
- [x] Rate limit: 429 sa brute-force (authLimiter 10/15min sa credential
  endpoints; express-rate-limit ang naglo-log — V16.3).
- [x] Audit: auth events (register, login success/fail, logout, refresh reuse,
  forgot, password reset) → `activity_log` (best-effort, hindi nagfa-fail ang
  request kapag hindi na-log).
- [x] Token values: never logged (requestLogger skip headers by design; ang
  service/controller ay hindi naglo-log ng tokens/passwords).

### Acceptance
- [x] Register → login → redirect sa patient portal; reload → silent refresh
  ay nagpapatuloy ng session.
  ✅ LIVE VERIFIED 2026-10-02: backend logs — `POST /register 201`, duplicate
  `409`, `POST /login 200` → portal, reload → naka-login pa rin.
- [x] Admin at doctor login → tama ang redirect at role.
  ✅ LIVE VERIFIED 2026-10-02: admin login `200` → admin console (backend logs);
  doctor login — ang `findDoctor` directory gate ay tinanggal (ang directory ay
  empty hanggang Phase 5; ang API ang source of truth), ang `App.jsx` guard ay
  gumagana lang kapag may laman ang directory.
- [x] Wrong password ×11 → 429.
  ✅ LIVE VERIFIED 2026-10-02: `tests/auth.ratelimit.test.js` green; ang 429
  handler bug (500 imbis na 429) ay naayos at na-verify.
- [x] `npm test` — lahat ng auth tests tumatakbo.
  ✅ LIVE VERIFIED 2026-10-02: **59/59 passed, 0 failed** sa user machine
  (kasama ang 3 integration suites laban sa tunay na Supabase).

---

## Phase 3 — Public Content + Directory (walang login) — ✅ TAPOS (verified live 2026-10-02)

**Goal:** ang lahat ng public pages ay nabubuhay na mula sa DB.

### Backend
- [x] `modules/settings` — **GET public** clinic info (`clinic_info` +
  `app_settings` public subset; ang admin write ay nasa Phase 6).
  ✅ Implemented 2026-10-02: `GET /api/settings/public` → `{ clinic, preferences }`.
- [x] `modules/doctors` — public directory: list + filter by specialty +
  search; rating average galing sa `v_doctor_rating_averages` (laging may
  review count); specialties lookup.
  ✅ Implemented 2026-10-02: `GET /api/doctors` (specialty uuid/name, search sa
  name+specialty, status, limit/offset), `GET /api/doctors/specialties`,
  `GET /api/doctors/:id`; rating merge mula sa view.
- [x] `modules/stories` — approved testimonials lang (`status='approved'`).
  ✅ Implemented 2026-10-02: `GET /api/stories` — walang `patient_id`/`reviewed_by` (PII).
- [x] `modules/contact` — **POST** submission; i-encrypt ang [ENC] fields
  (`contact_messages.name/email/message`) via `crypto.js`.
  ✅ Implemented 2026-10-02: `POST /api/contact` + `contactLimiter` (5/15min);
  encrypt bago i-save; 201 generic ack.

### Frontend
- [x] `Landing.jsx` — hero, stats, featured doctors, care finder ← settings/doctors API.
  ✅ Implemented 2026-10-02: `store.doctors`/`store.specialties`/`store.clinic` (reactive).
- [x] `DoctorsPage.jsx` — directory + specialty filter ← doctors API.
  ✅ Implemented 2026-10-02: client-side filter sa API data; `DoctorRatingPill`
  ay nagpapakita ng `avg_rating`/`rating_count` mula sa view; skeleton hanggang
  mag-load ang API (2.5s fallback).
- [x] `ServicesPage.jsx`, `AboutPage.jsx` ← settings API (clinic identity).
  ✅ Implemented 2026-10-02: `store.clinic` + `PublicFooter clinic` prop.
- [x] `ContactPage.jsx` — form → POST; success toast.
  ✅ Implemented 2026-10-02: `POST /api/contact` (auth:false); server 400 →
  field errors; 429 → rate-limit toast; `Sending…` disabled state.
- [x] `data.js` — ang `HOSPITAL`/`SPECIALTIES`/`DOCTORS` constants ay
  gawing hydration targets (store.clinic ← API), hindi hardcoded.
  ✅ Implemented 2026-10-02: store hydration sa mount (`apiOptional`, tahimik
  kapag offline); `window.DOCTORS`/`window.SPECIALTIES` naka-sync para sa
  direktang imports (`findDoctor`); `nmc.specialties` persisted.

### Security checklist
- [x] Public endpoints: read-only, walang PII leakage (TIER 3 plaintext lang —
  ENCRYPTION_DESIGN §1).
  ✅ Verified: doctors=`GET` lang (walang [ENC] columns sa table); stories=
  walang `patient_id`/`reviewed_by`; settings=public subset lang.
- [x] Contact POST: zod validation + rate limit + [ENC] encryption bago i-save.
  ✅ Verified: `contactSchema.strict()` (message 10–2000 = DB CHECK),
  `contactLimiter` 5/15min, `encryptField` sa service; integration test ay
  nagpapatunay na `v1:` ciphertext ang nasa DB.
- [x] XSS: React default escaping; **bawal `dangerouslySetInnerHTML`** sa
  anumang DB-sourced text (FRONTEND_SECURITY_AUDIT).
  ✅ Verified: walang `dangerouslySetInnerHTML` sa mga binagong pages.

### Acceptance
- [x] Landing + Doctors page nagre-render mula sa totoong DB rows.
  ✅ LIVE VERIFIED 2026-10-02: `#/` → 10 department chips mula sa DB;
  `#/doctors` → "18 of 18 doctors" na may ★ rating + review count mula sa
  `v_doctor_rating_averages`; `#/about` → stats (18 specialists, 10 departments)
  galing sa DB. Screenshots confirmed ng user.
- [x] Contact submission lumilitaw sa DB (encrypted fields) — i-verify sa
  Supabase table editor na ciphertext ang nasa [ENC] columns.
  ✅ LIVE VERIFIED 2026-10-02: ang integration test (`POST /contact → 201`)
  ay nagpatunay na ang `name`/`email`/`message` ay `v1:` ciphertext sa DB
  (walang plaintext leak), at naglinis pagkatapos — kaya empty ang table sa
  Table Editor. `npm test`: **76/76 passed, 0 failed**.

> **Phase 3 sign-off (2026-10-02):** lahat ng acceptance criteria ay verified
> live — `npm test` 76/76 sa user machine (laban sa tunay na Supabase), at ang
> browser checks (landing departments, doctors directory + ratings, about
> stats, API endpoints) ay green ayon sa screenshots at API responses ng user.
> Natagpuang isyu sa verification at naayos: 7 frontend files ang na-push na
> may `ghfetch` header line (Vite parse error) — tinanggal at na-push ulit.
> Phase 3 ay sarado; susunod ay Phase 4.

---

## Phase 4 — Patient Portal Core (profile + appointments)

**Goal:** booking end-to-end — ang pinaka-critical na clinic path. Dito
inaaktibo ang [ENC] PHI fields at ang slot logic.

### Backend
- [x] `modules/patients` — GET/PUT own profile; **[ENC]** fields
  (`date_of_birth`, `blood_type`, `allergies`, `address`, `emergency_contact`)
  i-encrypt on write / i-decrypt on read (`crypto.js`); implemented + unit
  tested. `phone_search` blind index: HINDI kinailangan (walang equality
  search sa phone sa Phase 4 scope — profile ay self-scoped).
- [x] `modules/appointments` — create (slots mula sa
  `fn_available_slots(doctor_id, date, duration)`), reschedule
  (`p_exclude_appt_id` — hindi kino-consider na taken ang sariling slot),
  cancel, list own; proxy booking (`booked_for` / family members);
  `auto_confirm_appointments` pref mula sa `app_settings`; status transitions
  valid paths lang; reference code (`AP-000123`) sa confirmation.
- [x] `modules/ratings` — submit (one per completed appointment —
  `UNIQUE(appointment_id)` DB guard).
- [x] Migration `database/migrations/003_phase4.sql` (idempotent):
  `patients.date_of_birth` date→text (ciphertext storage), drop ng
  `char_length` CHECKs sa `appointments.reason`/`notes` (validation lumipat
  sa backend Zod — ayon sa schema.sql encryption playbook).

### Frontend
- [x] `Profile.jsx` — profile CRUD + toggles (`email_reminders`,
  `portal_notifications`) + family members (`patient_family_members`) —
  wired sa tunay na API.
- [x] `DoctorListing.jsx` → `DoctorAvailability.jsx` → `BookAppointment.jsx` →
  `BookingConfirmation.jsx` — full booking flow, wired sa tunay na API
  (slots, proxy booking, confirmation via `?ref=`).
- [x] `AppointmentDetails/Status/History.jsx` — timeline
  (`appointment_status_history`), reschedule, cancel, .ics download —
  wired sa tunay na API.
- [x] Rating modal pagkatapos ng completed visit (`RatingModal.jsx` —
  POST `/api/ratings`; completed-only, one-per-appointment).

### Security checklist (pinaka-maraming BOLA surface — API1)
- [x] **LAHAT** ng queries ay naka-scope: `patient_id = JWT.sub` sa WHERE —
  hindi trusted mula sa body/param (BOLA #1). Iba pang pasyente → 404.
- [x] Slot race: re-check sa service + `uq_appointments_active_slot`
  partial unique index ang DB backstop; i-handle ang unique violation nang
  graceful (409, hindi 500) — 23505 → `ApiError.conflict`.
- [x] Status transitions: hindi pwedeng i-cancel ng patient ang completed;
  hindi pwedeng baguhin ng iba.
- [x] [ENC] fields: never in logs; decrypt lang kung owner ang requester.
- [x] Reschedule: date future + within clinic hours (via
  `fn_available_slots` — oras na wala sa availability ay 409).

### Acceptance
- [ ] Book → visible agad sa history + status timeline; reschedule/cancel
  gumagana; double-booking attempt → 409. (PENDING: IVAN live verification —
  code + unit tests tapos na.)
- [ ] Patient A HINDI makikita ang appointment ni Patient B (404/403) —
  i-test gamit ang dalawang account. (PENDING: IVAN live verification;
  ownership tests nasa `appointments.unit.test.js`.)
- [x] `npm test` — `tests/appointments.test.js` (conflict, race, ownership):
  **47/47 pass** sa scratch (24 bagong unit tests; integration suite ay
  graceful-skip nang walang .env — tatakbo sa user machine laban sa tunay
  na Supabase).

---

## Phase 5 — Doctor Portal

**Goal:** kumpleto ang appointment lifecycle sa doctor side (schedule →
complete visit / no-show → notes → records → feedback).

### Backend
- [ ] `modules/doctors` — own schedule (weekly availability editor sa
  `doctor_weekly_availability`), own profile view; portal-access grant /
  reset / revoke ng admin ay nasa Phase 6 (bcrypt hashing sa
  `doctor.service`).
- [ ] `modules/appointments` (doctor-scoped) — today/week views,
  complete visit (gumagawa ng `medical_records` row) + no-show status.
- [ ] `modules/records` — write `medical_records` / `lab_results` /
  `medications` (LAHAT may [ENC] fields — schema registry); doctor-scoped
  read ng pasyenteng na-attendan niya.
- [ ] `modules/ratings` (doctor view) — `visit_ratings` ng sariling visits +
  `v_doctor_rating_averages`.

### Frontend
- [ ] `DoctorDashboard.jsx` — today's schedule, complete visit / no-show.
- [ ] `DoctorWeekView.jsx` + `WeekGrid.jsx` — week view.
- [ ] `CompleteVisitModal.jsx` + `VisitNotesModal.jsx` — notes + records.
- [ ] `DoctorPatients.jsx` + `PatientHistoryModal.jsx` — visit history +
  amended notes.
- [ ] `DoctorFeedback.jsx` — ratings page.

### Security checklist
- [ ] Doctor sees OWN appointments/patients ONLY (`doctor_id = JWT.sub`).
- [ ] Revoked `doctor_accounts` → login fail + existing tokens invalidated
  (revoke refresh rows; access token mawawala in ≤15m).
- [ ] [ENC] sa lahat ng records fields; doctor lang ang may access sa
  pasyenteng na-attendan niya (hindi buong directory).

### Acceptance
- [ ] Complete visit → `medical_records` row + status='completed' + rating
  prompt available sa patient.
- [ ] No-show → slot napapalaya (hindi naka-block sa
  `uq_appointments_active_slot`).
- [ ] Doctor B hindi makikita ang schedule/pasyente ni Doctor A.
- [ ] `npm test` — `tests/doctors.test.js`, `tests/records.test.js`,
  `tests/ratings.test.js`.

---

## Phase 6 — Admin Console

**Goal:** full management + audit trail. Pagdating dito, ang mga patterns
(auth middleware, envelope, validation, [ENC]) ay established na — mekanikal
na ang CRUD wave.

### Backend
- [ ] `modules/patients` (admin) — list/add/edit/delete + registry.
- [ ] `modules/doctors` (admin) — CRUD + availability editor +
  **portal access** (grant/reset/revoke → `doctor_accounts`, bcrypt).
- [ ] `modules/appointments` (admin) — create/edit/status/delete/
  complete-visit; **bawat action ay may `activity_log` write** (V9).
- [ ] `modules/records` (admin) — labs & medications encoding.
- [ ] `modules/stories` (admin) — moderation (approve/reject/unpublish).
- [ ] `modules/messages` — support tickets + reply loop.
- [ ] `modules/contact` (admin) — list + mark-handled.
- [ ] `modules/settings` (admin) — clinic info + appointment prefs write
  (auto-confirm toggle dito makakaapekto sa Phase 4 behavior).
- [ ] `modules/activity` — audit trail read (filterable, paginated).
- [ ] `modules/reports` — stats, per-specialty breakdown, busiest doctors,
  CSV export.
- [ ] `modules/notifications` — generate notifications sa status changes.

### Frontend (`frontend/src/admin/*`)
- [ ] `AdminDashboard.jsx`, `PatientsMgmt.jsx` (+ `PatientFormModal`,
  `PatientRecordsModal`), `DoctorsMgmt.jsx` (+ `DoctorFormModal` —
  portal access fields), `AppointmentsMgmt.jsx` (+ `AppointmentModals`),
  `StoriesMgmt.jsx`, `TicketsMgmt.jsx`, `AdminSettings.jsx`,
  `AdminActivity.jsx`, `AdminReports.jsx` (+ `charts.jsx`).

### Security checklist
- [ ] `requireRole('admin')` sa LAHAT ng admin endpoints (single mount
  point sa `routes/index.js`).
- [ ] Audit trail sa lahat ng mutating actions (sino, ano, kailan — V9).
- [ ] CSV export: formula-injection guard (`=`, `+`, `-`, `@` prefix sa cells).
- [ ] Delete actions: confirm modal + soft patterns kung saan applicable.

### Acceptance
- [ ] Buong admin console gumagana laban sa totoong data.
- [ ] Activity page nakikita ang bawat admin action na ginawa mo sa test run.
- [ ] `npm test` — `tests/patients/settings/stories/messages/notifications/
  contact.test.js`.

---

## Phase 7 — Storage (Avatars)

**Goal:** patient/doctor photos — ayon sa `docs/STORAGE_DESIGN.md`
(STORAGE SETUP section sa `database/schema.sql`).

### DB
- [ ] I-apply ang storage buckets setup: **private** `avatars` bucket
  (hindi public — signed URLs lang ang access).

### Backend
- [ ] Upload route: **≤1MB file, base64 JSON** (route-specific `express.json`
  limit ~3mb — encoded overhead ~1.4x); validate MIME (png/jpeg/webp) +
  magic bytes, hindi lang extension.
- [ ] Upload via `supabase.storage` client (bundled na sa `config/db.js` —
  walang bagong dependency); overwrite per account path
  (`avatars/{role}/{account_id}.png`).
- [ ] Read: backend-signed URL, **TTL 5 min** — hindi public URL.

### Frontend
- [ ] `Profile.jsx` — change photo (preview + upload).
- [ ] `DoctorFormModal.jsx` — doctor photo.

### Security checklist
- [ ] Private bucket: walang direct client access (service-role writes +
  signed URLs only — STORAGE_DESIGN).
- [ ] Size/type validation sa backend (hindi trusted ang client claim).
- [ ] Ang signed URL ay never cached beyond TTL sa frontend.

### Acceptance
- [ ] Upload → photo nagre-render sa profile/header; direct bucket URL
  (walang signature) → denied.

---

## Phase 8 — Email + Reminders (Brevo)

**Goal:** transactional emails — walang SDK, Node 18 built-in `fetch` laban sa
Brevo v3 REST API (desisyon sa BACKEND_ARCHITECTURE dependency notes).

### Backend
- [ ] `config/brevo.js` — client singleton: API key mula sa env
  (xkeysib-), verified sender, **outbound HTTPS with request timeout**.
- [ ] `shared/services/email.service.js` — **best-effort**: ang email failure
  ay HINDI hahadlang sa main API request (i-log lang).
- [ ] I-wire ang 4 templates (naka-scaffold na sa `shared/templates/emails/`):
  appointmentConfirmation, appointmentReminder, appointmentStatusUpdate,
  contactAcknowledgment.
- [ ] **Forgot-password flow kumpleto** (Phase 2 token + email send + reset
  endpoint; single-use token, short TTL, revoke pagkatapos gamitin).
- [ ] `jobs/appointmentReminder.job.js` — cron: mga appointment bukas →
  reminder (respetuhin ang `patients.email_reminders` toggle); idempotent
  (hindi paulit-ulit na nagsesend).

### Frontend
- [ ] `ForgotPassword.jsx` — i-wire na (request reset → email → reset form).

### Security checklist
- [ ] API key never logged; email failure ay log lang (hindi user-visible
  stack trace).
- [ ] Reset token: hashed sa DB, single-use, ≤1h TTL, revoke-all sa reset.
- [ ] Sender identity: verified sa Brevo (Senders, domains, IPs).

### Acceptance
- [ ] Book → confirmation email; status change → update email; contact →
  acknowledgment.
- [ ] Forgot password: buong loop gumagana (request → email link → reset →
  login gamit ang bagong password).

---

## Phase 9 — Messaging + Notifications (+ Realtime)

**Goal:** support loop at notification bell; realtime bilang enhancement.

### Backend
- [ ] `modules/messages` — two-way thread (`support_tickets` +
  `support_ticket_messages`; body ay [ENC]).
- [ ] `modules/notifications` — unread count, mark-all-read, list.
- [ ] **Realtime (SECURITY_ALIGNMENT §J):** i-uncomment ang
  `SUPABASE_SIGNING_PRIVATE_KEY` sa `.env` (Settings → JWT Keys → export
  ES256 private key) → `GET /api/realtime/token` — nagmi-mint ng short-TTL
  Supabase realtime token per authenticated user. **Bawal anon/public
  channel** — authenticated token lang.
- [ ] Poll fallback: kung realtime off, 30s polling sa notifications.

### Frontend
- [ ] `PatientMessages.jsx` + `TicketsMgmt.jsx` (admin) — thread UI.
- [ ] Notification bell (topbar) — unread badge, mark-all-read.
- [ ] Realtime subscribe sa notifications channel gamit ang minted token.

### Security checklist
- [ ] Ticket body [ENC]; access: patient = own tickets, admin = all.
- [ ] Realtime token: short TTL, per-user, hindi anon (§J).

### Acceptance
- [ ] Patient nag-message → admin nakakita → admin nag-reply → patient
  nakatanggap ng notification (+ realtime kung enabled).
- [ ] `npm test` — `tests/messages.test.js`, `tests/notifications.test.js`.

---

## Phase 10 — Hardening + Deployment

**Goal:** production-ready — security, monitoring, deployment.

### Checklist
- [ ] `npm audit --omit=dev` = **0** sa dalawang proyekto (pre-deploy gate).
- [ ] Rate limits review per endpoint class (API4); helmet CSP review.
- [ ] Structured logging / error monitoring; request logs sa persistent store
  sa production (V16.2/V16.4).
- [ ] **Full security audit pass** — patakbuhin ang lahat ng checklist sa
  BACKEND / DATABASE / FRONTEND_SECURITY_AUDIT.md; i-mark ang bawat item.
- [ ] **Vercel deploy:** backend (serverless adapter — hiwalay na maliit na
  entry file, walang `listen`) + frontend (static `dist/`); env vars sa
  **Vercel dashboard** (hindi sa commit); `CORS_ORIGINS` → prod domain;
  `VITE_API_BASE_URL` → prod API URL.
- [ ] Supabase prod hygiene: PITR/backup enable + isang restore drill;
  service key rotation policy.
- [ ] Monitoring: `/api/health` sa uptime checker; alerting sa 5xx spikes.
- [ ] E2E manual walkthrough sa prod build: register → book → doctor
  completes → rate → admin reports.

### Acceptance
- [ ] Live URL gumagana end-to-end; audit checklists lahat ✓; backup +
  restore na-verify.

---

## Cross-Cutting Rules (sa LAHAT ng phases)

1. **Validation** — zod sa lahat ng input (body/query/params) via
   `middleware/validate.js`; never trust ang frontend (API3).
2. **Authorization** — `requireRole()` + service-level scoping; ownership
   check sa query level (`WHERE patient_id = JWT.sub`), hindi sa client data
   (API1/BOLA). RLS mananatiling commented — service-role ang path (§6.2).
3. **Errors** — generic message sa client; stack/details sa logs lang;
   `asyncHandler` sa lahat ng async routes (V16.5).
4. **Logs** — walang secrets, tokens, o PHI (V16.2/V16.4).
5. **Encryption** — TIER 1 [ENC] via `crypto.js` (AES-256-GCM); blind index
   (TIER 2) sa equality search; password = bcrypt hash lang (hindi ENC).
6. **API shape** — `{success, data, meta}` envelope sa lahat ng responses;
   pag nagbago ang contract, i-update ang zod schemas + `data.js` targets.
7. **Schema discipline** — `database/schema.sql` ang singleton source of
   truth; incremental changes = migrations folder + i-sync sa schema.sql.
8. **Tests** — bawat module may `tests/<module>.test.js` (`node --test`);
   `npm run lint` = 0 errors bago ituring na tapos ang phase.
9. **Docs** — pag may nabagong env var / endpoint / flow, i-update ang
   relevant doc sa alignment table sa ibaba.

---

## Alignment Map — Phase → Existing Files

| Phase | Backend files | DB | Frontend files | Doc refs |
| --- | --- | --- | --- | --- |
| 1 | `shared/utils/crypto.js`, `middleware/validate.js` | `migrations/001_refresh_tokens.sql` (bago) | `shared/api.js` (bago), `store.jsx`, `auth.jsx` | ARCH §3, §6.3; SEC_ALIGN §H |
| 2 | `modules/auth/*`, `tests/auth.test.js` | `patients`/`admins`/`doctor_accounts` | `Login/Register/AdminLogin/DoctorLogin.jsx`, `App.jsx` guards | BACKEND_AUDIT V2/V3 |
| 3 | `settings`, `doctors`, `stories`, `contact` modules | `clinic_info`, `app_settings`, `doctors`, `patient_stories`, `contact_messages` | `Landing`, `DoctorsPage`, `ServicesPage`, `AboutPage`, `ContactPage`, `data.js` | ARCH §5 mapping |
| 4 | `patients`, `appointments`, `ratings` modules | `patients`, `appointments`, `fn_available_slots`, `uq_appointments_active_slot`, `patient_family_members` | `Profile`, `DoctorListing/Availability`, `BookAppointment`, `Appointment*`, `BookingConfirmation` | ENCRYPTION_DESIGN; BACKEND_AUDIT §appointments |
| 5 | `doctors` (doctor), `appointments` (doctor), `records`, `ratings` | `doctor_weekly_availability`, `medical_records`, `lab_results`, `medications`, `visit_ratings` | `doctor/*` (lahat) | BACKEND_AUDIT V5.2/V11 |
| 6 | admin sides ng `patients/doctors/appointments/records`, `stories`, `messages`, `contact`, `settings`, `activity`, `reports`, `notifications` | `activity_log` + lahat ng tables | `admin/*` (lahat) | ARCH §5 Admin Console |
| 7 | upload route (patients/doctors) | `avatars` bucket (STORAGE SETUP) | `Profile.jsx`, `DoctorFormModal.jsx` | STORAGE_DESIGN |
| 8 | `config/brevo.js`, `email.service.js`, `jobs/*`, `templates/emails/*` | — | `ForgotPassword.jsx` | ARCH dependency notes |
| 9 | `messages`, `notifications`, realtime endpoint | `support_tickets(+_messages)`, `notifications` | `PatientMessages.jsx`, bell (topbar) | SEC_ALIGN §J |
| 10 | prod adapter, logging | backup/PITR | `dist/` deploy | lahat ng `*AUDIT*.md` |

---

## Verification Commands (bawat phase)

```bash
# Backend
cd backend
npm run dev          # nodemon boot — dapat "[server] MedicaCare backend listening"
npm run lint         # 0 errors ang barahan
npm test             # node --test — module tests ng phase
npm audit --omit=dev # dapat 0

# Frontend
cd frontend
npm run dev          # 5173 — i-test ang wired pages laban sa backend
npm run build        # dapat clean

# API smoke (halimbawa)
curl http://localhost:3000/api/health
```

**Definition of done per phase:** lahat ng checkbox ✓ → lint/test green →
manual walkthrough ng acceptance criteria → i-update ang Changelog sa ibaba.

---

## Changelog
- **2026-10-02 — Phase 4 implemented (backend + frontend, code-complete —
  pending live verification):** `modules/patients` (GET/PUT own profile,
  [ENC] encrypt-on-write/decrypt-on-read ng `date_of_birth`/`blood_type`/
  `allergies`/`address`/`emergency_contact`, family CRUD),
  `modules/appointments` (slots via `fn_available_slots`, book, reschedule
  with own-slot exclusion, cancel, list own, proxy booking via family,
  `auto_confirm_appointments` mula sa `app_settings`, `AP-000123` reference
  codes, 23505→409 race backstop), `modules/ratings` (completed-only,
  `UNIQUE(appointment_id)`→409, iba pang pasyente →404); mount sa
  `routes/index.js`; `bookingLimiter` 20/15min. Migration
  `003_phase4.sql` (idempotent: `patients.date_of_birth` date→text, drop
  ng `char_length` CHECKs sa `appointments.reason`/`notes` — validation sa
  backend Zod). Tests: `appointments.unit.test.js` (24 unit — conflict, race,
  ownership, ciphertext-at-rest, ratings guard, status transitions) +
  `appointments.test.js` integration (graceful-skip nang walang .env) —
  **47/47 pass** sa scratch, lint malinis. BOLA: lahat ng queries scoped
  `patient_id = JWT.sub`; [ENC] never logged. Frontend: `api.js` (13 bagong
  endpoints), `store.jsx` (profile+family hydration, DOCTORS/SPECIALTIES sync
  untouched), `patient/helpers.js`, `RatingModal.jsx`, Profile/DoctorAvailability/
  BookAppointment/BookingConfirmation/AppointmentDetails/AppointmentStatus/
  AppointmentHistory/PatientDashboard/DoctorListing ← tunay na API. FIX bago
  i-push: gender select `M/F/O` → backend enum `male/female/other`. Hindi pa
  tapos ang Phase 4 — naghihintay ng IVAN live verification bago ang formal
  sign-off.
- **2026-10-02 — Phase 3 implemented (backend + frontend, na-push sa `main`):**
  `modules/settings` (`GET /api/settings/public`), `modules/doctors`
  (`GET /api/doctors`, `/specialties`, `/:id` + rating merge mula sa
  `v_doctor_rating_averages`), `modules/stories` (`GET /api/stories`,
  approved-only, walang PII), `modules/contact` (`POST /api/contact`,
  `contactLimiter` 5/15min, [ENC] encryption bago i-save); mount sa
  `routes/index.js`. Tests: `public.unit.test.js` (8 unit) +
  `public.test.js` (10 integration, kasama ang ciphertext-at-rest check at
  429 spam test) — 23/23 unit pasado sa scratch, lint malinis. Frontend:
  `apiOptional` (quiet), store public hydration (clinic/doctors/specialties/
  stories/testimonials + prefs), `window.DOCTORS`/`window.SPECIALTIES` sync,
  Landing/DoctorsPage/AboutPage/ContactPage/ServicesPage ← store,
  `DoctorRatingPill` API rating props, `PublicFooter clinic` prop, ContactPage
  → tunay na POST.
- **2026-10-02 — Phase 3 LIVE VERIFIED + formal sign-off:** `npm test` 76/76
  sa user machine; landing/doctors/about nagre-render mula sa DB (screenshots);
  contact encryption at-rest verified (`v1:` ciphertext). Naayos: 7 frontend
  files na na-push na may `ghfetch` header line (Vite error) — tinanggal at
  na-push ulit. Phase 3 ay TAPOS; susunod ay Phase 4.

## Changelog

| Date | Progress |
| --- | --- |
| 2026-10-01 | Phase 0 ✅ — boot chain live, health 200 (db:ok), secrets sa `.env`, lint clean. Roadmap nilikha. |
| 2026-10-02 | Phase 2 ✅ — auth module: `tokens.js`/`passwords.js`, `auth.validation/repository/service/middleware/controller/routes` (bcrypt cost 12, JWT iss/aud/exp, rotate + reuse detection, generic errors, authLimiter sa credential endpoints, activity_log audit), `002_password_resets.sql` migration, `cookie-parser` dep, `npm test` script fix. Frontend: Login/Register/AdminLogin/DoctorLogin/ForgotPassword → API, OTP modal tinanggal, store logout → server revoke. Unit 15/15 pass, lint clean, route wiring verified; integration tests graceful-skip nang walang .env (user-side tatakbo). FIX 2026-10-02: ang rate-limiter 429 handler ay nagbabalik ng 500 (`next(string)` bug sa Phase 0 `rateLimiter.js` — ginawang `next(ApiError.tooManyRequests())`); + `auth.test.js` harness fix (hindi pwedeng lagyan ng properties ang frozen module namespace — ginawang local `state`). |
| 2026-10-01 | Phase 1 ✅ — shared plumbing: `001_refresh_tokens.sql` migration + README, `crypto.js` (AES-256-GCM/HMAC, 13 tests pass), `validate.js` (zod, 6 tests pass), `api.js` (fetch wrapper + memory-only token + silent refresh, 9 mock-server tests pass), `store.jsx` session adapter. Backend lint clean. ✅ Live verified: migration applied, /api/health 200 (db:ok), frontend :5173 + CORS ok. |








