# MedicaCare Database — Public Pages + Patient Portal + Admin Console + Doctor Portal

PostgreSQL schema para sa **buong MedicaCare app** (Public pages + Patient
Portal + Admin Console + Doctor portal), handa sa **Supabase** (o kahit anong
PostgreSQL 13+). Layunin:
**hindi kulang** — bawat feature ng apat na surfaces ay may katumbas na
table/column/function sa schema, at **walang duplicate na tables** (shared ang
patients/doctors/appointments sa lahat ng console).

## Files

| File | Ano |
| --- | --- |
| `schema.sql` | Buong schema: tables, enums, indexes, triggers, slot-availability function, commented RLS policies para sa Supabase, **at seed data sa dulo** — fictional demo data ng buong app (doctors, patients, appointments, ratings, labs/meds, messages, stories, activity) + demo login accounts. |
| `migrations/` | Backend-owned migrations — HIWALAY sa `schema.sql` (hindi clinic domain). Bawat file ay idempotent (`IF NOT EXISTS`) at naka-number nang sunod-sunod. |

## Paano i-run

**Supabase (recommended):**
1. Buhat ng project sa [supabase.com](https://supabase.com) → **SQL Editor**
2. I-paste ang buong `schema.sql` → **Run**
3. I-enable ang RLS policies sa dulo ng file kapag naka-Supabase Auth na

**Plain PostgreSQL / psql:**

```bash
psql -U postgres -d medicacare -f database/schema.sql
```

## Migrations (backend-owned)

Ang `schema.sql` ang singleton source of truth ng 21 clinic tables. Ang mga
backend-owned tables (hal. `refresh_tokens` — JWT session store) ay HINDI
kasama doon (docs/BACKEND_ARCHITECTURE.md §6.3) — nasa `migrations/` sila.

| # | File | Ano |
| --- | --- | --- |
| 001 | `migrations/001_refresh_tokens.sql` | `refresh_tokens` table — hash-only JWT refresh token store, rotation + reuse-detection semantics (Phase 1). |
| 002 | `migrations/002_password_resets.sql` | `password_resets` table — hash-only, single-use, 1h TTL reset token store (Phase 2; email send sa Phase 8). |

**Paano i-apply (sa ibabaw ng schema.sql):**

Supabase dashboard → SQL Editor → i-paste ang migration file → Run. O sa psql:

```bash
psql -U postgres -d medicacare -f database/migrations/001_refresh_tokens.sql
```

Idempotent ang mga migration (ligtas i-run nang paulit-ulit). Huwag nang
baguhin ang isang migration na na-apply na sa shared database — gumawa ng
bagong numbered file sa halip.

## Demo accounts (seed data — naka-hash ang passwords sa DB)

| Role | Login page | Email | Password |
| --- | --- | --- | --- |
| Patient | `#/login` (public) | `mwawlasly@gmail.com` | `patient123` |
| Admin / Staff | `#/admin/login` | `angelitotallod1234@gmail.com` | `admin123` |
| Doctor | `#/doctor/login` | `doctor@medicacare.ph` | `doctor123` |

Ipinapakita rin ang mga credentials na ito sa demo-account panel ng mga login
screens. Ang password hashes ay ginawa via `crypt()` (pgcrypto) — hindi plain
text sa DB. Sa totoong deployment: i-rotate ang mga demo password at alisin ang
seed credentials bago i-publish.

## Ano ang naka-seed (lahat ng fictional demo data ng app)

- **10 specialties**, **18 doctors** (may photo, fee, room, status, weekly availability)
- **26 patients** (p1 = demo patient, kumpleto ang health summary; may `patient123` hash lahat)
- **~142 appointments**: 25 fixed-date + 24 "today" (dated `current_date` kaya laging may live na schedule) + ~93 fictional completed demo visits (dinadala nila ang ~93 seed ratings — FK-safe)
- **Visit ratings** (deterministic 4–7 bawat doctor, tugma sa seeded rating tiers)
- **8 patient stories** (2 pending para sa moderation demo + 6 approved sa public carousel — kasama ang 3 fictional prototype stories, naka-preserba sa DB)
- **3 lab results** (findings JSONB, may high flag) + **3 medications** + **2 family members** (p1)
- **4 support tickets** (2 open, 2 resolved na may staff reply sa thread)
- **8 activity log entries** (timestamps relative sa run time)
- **10 medical records** (auto-derived mula sa completed visits na may doctor notes — tugma sa app's records behavior)
- **4 notifications** para sa demo patient (2 unread para live ang topbar bell + "Mark all as read", 2 read para may history)
- **1 admin** + **1 doctor portal account** + `clinic_info` / `app_settings` singleton rows

Note: hindi idempotent ang seed — i-run ang buong `schema.sql` sa bagong
database lamang. Kung may sakaling tumama ang isang "today" slot sa isang
fixed-date na aktibong appointment, may `ON CONFLICT DO NOTHING` guard ang
appointments seed para hindi bumagsak ang buong run.

## Feature → Database Mapping (Patient Portal)

| Patient Portal Feature | Tables / Function |
| --- | --- |
| Register (create account) | `patients` (insert; `password_hash` — hashed, hindi plain text) |
| Login / session | `patients.email` + `patients.password_hash` (o Supabase Auth + `patients.auth_user_id`) |
| Profile: view/edit info, address, emergency contact | `patients` (update) |
| Profile: change password | `patients.password_hash` (update) |
| Profile: change photo | `patients.photo_url` (update) |
| Dashboard: next appointment banner, stats | `appointments` (query by patient + status/date), `patients` |
| Dashboard: notifications bell | `notifications` (insert on status change, `read_at` for mark-all-read) |
| Find a doctor: search + specialty/status filters | `doctors` + `specialties` |
| Doctor cards: computed rating + review count, experience, fee, room, photo | `doctors` + `v_doctor_rating_averages` (computed; laging may review count) |
| Rate your visit (completed appointments, one rating per appointment) | `visit_ratings` (insert; `UNIQUE(appointment_id)` = DB-level guard) |
| Doctor Availability: date + time slots | `doctor_weekly_availability` + `fn_available_slots()` |
| Book appointment: validation, live summary | `appointments` (insert; CHECK constraints) |
| Double-booking guard ("booked slots are disabled") | `uq_appointments_active_slot` (partial unique index) + `fn_available_slots` |
| Booking Confirmation: reference number | `appointments.reference_code` (auto: `AP-000123`) |
| Appointment Status: progress timeline | `appointments.status` + `appointment_status_history` (auto ng trigger) |
| Appointment History: search/filter/sort/pagination | `appointments` + indexes (`idx_appointments_patient`, `idx_appointments_status_date`) |
| Appointment Details: receipt + .ics download | `appointments` + `patients` + `doctors` (join) |
| Reschedule (new date + available slots) | `appointments` update + `fn_available_slots(…, p_exclude_appt_id)` — ang sariling slot ng pasyente ay hindi tinuturing na "taken" (pareho ng reschedule modal ng app) |
| Cancel appointment | `appointments.status = 'cancelled'` + `cancelled_at` (trigger) |
| Medical Records: table + health summary | `medical_records` + `patients` (blood_type, allergies, emergency_contact) |
| Help & Support: FAQs, contact info | Static UI content — walang table na kailangan (phase 2 kung dynamic) |
| Help & Support: Share your experience | `patient_stories` (insert as `pending`; display name lang ang publishable) |
| Profile: Family members (proxy booking) | `patient_family_members` (CRUD; ang `appointments.booked_for` ang snapshot sa booking) |
| Booking: "Who is this visit for?" | `appointments.booked_for` (NULL = self; pangalan ng family member kung proxy) |
| Medical Records: Lab results section | `lab_results` (findings bilang JSONB; status final/pending) |
| Medical Records: Medications section | `medications` (dose/form/frequency/instructions, prescriber) |
| Profile: Email reminders / Portal notifications toggles | `patients.email_reminders` + `patients.portal_notifications` |
| My messages: "Message the clinic" + follow-ups | `support_tickets` + `support_ticket_messages` (thread; status open/resolved) |
| Status: "No-show" sa history filters | `appointment_status` enum value `'no-show'` |

## Admin Console → Database Mapping

| Admin Console Feature | Tables / Function |
| --- | --- |
| Admin Login (`#/admin/login`) | `admins` (email + `password_hash`, o Supabase Auth + `admins.auth_user_id`) |
| Topbar user card + logout | `admins` (identity, role) |
| Dashboard: today's appointments, pending, totals, activity chart | `appointments` + `patients` + `doctors` (computed queries; walang kailangang extra table) |
| Dashboard: pending reviews, today's schedule | `appointments` (query by status/date) |
| Dashboard / Patients / Doctors / Appointments: CSV export | Data mula sa mga table + `downloadFile` sa app |
| Patients Management: list, search, gender filter, add, delete | `patients` (CRUD) |
| Doctors Management: list, search, add, edit (status, fee, room, photo), delete | `doctors` (CRUD) + `specialties` |
| Doctors Management: weekly availability editor | `doctor_weekly_availability` (per-doctor day rows) |
| Appointments Management: list, search, status filter, sort, pagination | `appointments` + `SortableTh` sa app |
| Appointments Management: inline status update (Pending → Confirmed → …) | `appointments.status` update + auto `appointment_status_history` (trigger) |
| Appointments Management: create (live availability) | `appointments` insert + `fn_available_slots()` |
| Appointments Management: view details, delete | `appointments` (read/delete) + ConfirmModal |
| Reports: stats, per-specialty breakdown, busiest doctors, CSV | Computed queries sa `appointments`/`doctors`/`medical_records` |
| Settings: Clinic information (name/phone/email/address + **clinic hours** → Open now/Closed pill at footer hours) | `clinic_info` (singleton row, id = 1; `hours` JSONB per-day) |
| Settings: Appointment preferences (email flags, auto-confirm, slot interval) | `app_settings` (singleton row, id = 1) |
| Settings: persistence note | Singleton rows sa DB — totoong persistence, hindi na in-memory |
| Patient stories: moderation (Approve / Reject / Unpublish / Restore) | `patient_stories` (status update + `reviewed_at` / `reviewed_by` audit trail) |
| Patient stories: sidebar badge (pending count) | `patient_stories` (query by status = 'pending') |
| Doctors page: Portal access (grant / reset / revoke) | `doctor_accounts` (email + `password_hash`, UNIQUE doctor_id; delete ng doctor = cascade) |
| Patients page: Add lab result / Add medication | `lab_results` + `medications` (insert/delete; lumalabas sa patient's Medical Records) |
| Complete visit (encode notes sa doctor's behalf) | `appointments.notes` (10–500 chars) + `medical_records` (record_type 'Consultation') |
| Patient messages page (reply loop) | `support_tickets` (status update) + `support_ticket_messages` (sender = 'staff') |
| Contact page submissions (public "Send us a message") | `contact_messages` (insert ng anonymous visitor — walang FK, email ang reply channel; `handled_at` kapag nasagot na; sa prototype toast-only muna) |
| Activity page (audit trail ng lahat ng roles) | `activity_log` (actor/action/detail; walang FK — display name ang actor) |

## Doctor Portal → Database Mapping

| Doctor Portal Feature | Tables / Function |
| --- | --- |
| Doctor Login (`#/doctor/login`) | `doctor_accounts` (email + `password_hash`; admin-issued mula sa Admin > Doctors) |
| Dashboard: Today's schedule (complete visit / no-show) | `appointments` (query by doctor + date + status) |
| Complete visit: doctor writes visit notes | `appointments.notes` (10–500 chars) + status = 'completed' + `medical_records` row |
| No-show button ("Patient did not arrive") | `appointments.status = 'no-show'` (slot automatic na napapalaya — wala sa active-slot index) |
| My patients: search + visit history + amended notes | `appointments` + `patients` (join) |
| This week: week view | `appointments` (query by doctor + date range) |
| Patient feedback: ratings + comments | `visit_ratings` (query by doctor; averages sa `v_doctor_rating_averages`) |

## Conventions

- **snake_case** columns; **UUID** primary keys (`gen_random_uuid()`)
- **Enums** sa fixed-value fields (`appointment_status`, `doctor_status`,
  `gender`, `lab_result_status`, `medication_status`, `support_ticket_status`;
  ang enum labels ay tumutugma sa values ng app — hal. `'no-show'`, `'on-leave'`)
- **`timestamptz`** sa lahat ng timestamps; `updated_at` ay auto (trigger)
- **Reference numbers**: `appointments.reference_code` = `AP-` + 6-digit sequence
- **Money**: `numeric(10,2)` (hindi float)
- **Em dash** sa SQL comments: exempt sa R-02 (hindi UI text)

## Postgres best-practices audit (Supabase agent skill v1.1.1)

Na-audit at na-apply ang [supabase-postgres-best-practices](https://github.com/supabase/agent-skills)
skill laban sa `schema.sql`. **Re-audit 2026-09-29:** lahat ng rules ay muling
na-verify at nag-close ang 5 security gaps (RLS coverage sa `contact_messages` +
public tables, `pgcrypto` sa `extensions` schema, view security note, force-RLS
guidance) — buong detalye sa `docs/DATABASE_SECURITY_AUDIT.md`:

| Rule (category) | Resulta |
| --- | --- |
| `query-missing-indexes` / `schema-foreign-key-indexes` (HIGH/CRITICAL) | ✅ Lahat ng FK columns ay may index na ngayon (14 FK indexes kabuuan) — mas mabilis na JOINs, cascades, at RLS policy lookups |
| `query-composite-indexes` (HIGH) | ✅ `idx_appointments_status_date (status, appointment_date)` — equality muna bago range |
| `query-partial-indexes` (HIGH) | ✅ `uq_appointments_active_slot` ay partial (pending/confirmed lang) |
| `security-rls-performance` (HIGH) | ✅ Lahat ng RLS policies ay gumagamit ng `(select auth.uid())` (initPlan, cached — hindi per-row) + `to authenticated` |
| `security-rls-basics` (CRITICAL) | ✅ Kumpletong commented policies bawat table; denied-by-default kapag naka-enable |
| `security-privileges` (MEDIUM) | ✅ Note: platform-managed roles lang sa Supabase, walang superuser sa app |
| `schema-data-types` / `schema-lowercase-identifiers` (HIGH/MEDIUM) | ✅ `text`/`timestamptz`/`numeric(10,2)`/enums, lowercase snake_case |
| `advanced-jsonb-indexing` (MEDIUM) | ✅ Commented GIN index sa `lab_results.findings` — i-uncomment lang kapag may containment queries |
| `monitor-vacuum-analyze` (MEDIUM) | ✅ `analyze;` pagkatapos ng bulk seed |
| `data-batch-inserts` (MEDIUM) | ✅ Multi-row batch inserts ang seed |
| `schema-primary-keys` (HIGH) | ⚠️ `gen_random_uuid()` (v4) ang PKs — OK sa scale ng clinic app; kapag lumaki na, i-consider ang UUIDv7 (`pg_uuidv7`) para sa index locality |
| `data-pagination` (MEDIUM-HIGH) | ℹ️ App-side note: OFFSET pagination ang admin lists — fine sa dami ng rows dito; keyset/cursor pagination kapag lumobo na |
| `conn-*` (CRITICAL) | ℹ️ App-side note: gamitin ang Supabase connection pooling (pooler) sa production; iwasan ang per-request connections sa serverless |

## Security notes (importante)

1. **Password**: `password_hash` lang ang itatago — i-hash sa app side
   (bcrypt/argon2) o gumamit ng Supabase Auth. Bawal ang plain text
   (pareho ng itinuro ng audit-002 #4).
2. **RLS**: naka-comment sa dulo ng schema ang ready-made policies. I-enable
   lang kapag naka-Supabase Auth na; walang policy = denied by default.
3. **service_role key**: huwag ilalagay sa frontend. Sa prototype, ang
   kaya ng app ay client-side lang — sa totoong deployment, API/RLS ang
   gagawa ng verification (tingnan din ang README.md "Limitations").
4. **Field-level encryption (PHI)**: ang mga column na may `[ENC]` marker sa
   schema (reason, notes, findings, meds, allergies, address, atbp.) ay
   iimbak bilang **AES-256-GCM ciphertext** sa totoong deployment — ine-
   encrypt/i-decrypt ang backend, key sa `ENCRYPTION_KEY` env lang. Ang
   Supabase at-rest encryption + TLS ay layered pa rin sa ilalim. Buong
   design at column classification: **`docs/ENCRYPTION_DESIGN.md`** ·
   cross-layer: `docs/SECURITY_ALIGNMENT.md` §I. Ang `password_hash` ay
   one-way HASH (hindi encryption) at hindi kasama rito.
5. **Storage buckets (avatars)**: ang profile photos ay nasa **PRIVATENG** `avatars`
   bucket sa Supabase Storage — backend-only uploads (service_role), backend-
   signed URLs (TTL 5 min) ang serve path, WALANG public policy. Buong design:
   **`docs/STORAGE_DESIGN.md`** · cross-layer: `docs/SECURITY_ALIGNMENT.md` §K.

## Next steps (pagkatapos i-wire sa Supabase)

1. I-uncomment ang RLS policies sa `schema.sql` kapag naka-Supabase Auth na
   (patient + admin policies).
2. I-wire ang frontend gamit ang `supabase-js` — una ang auth (register/login),
   tapos appointments (book/list/reschedule/cancel gamit ang
   `fn_available_slots`), tapos profile, records, notifications.
3. Admin console wiring: login sa `admins`, CRUD sa
   patients/doctors/appointments, labs/meds encoding sa `lab_results` +
   `medications`, portal access sa `doctor_accounts`, settings sa
   `clinic_info` + `app_settings` (dito magiging totoo ang mga preference flags).
4. Doctor portal wiring: login sa `doctor_accounts`, schedule/complete-visit
   sa `appointments` (status + notes), feedback sa `visit_ratings`.
5. Phase 3 (optional): audit log table (may `activity_log` na), email
   reminders integration (kapag may backend), at notification triggers na
   nagpopopulate ng `notifications` tuwing may status change.

