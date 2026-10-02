-- database/migrations/003_phase4.sql
-- Phase 4 — Patient Portal Core: gawing ciphertext-capable ang [ENC] columns.
--
-- 1) patients.date_of_birth: date → text.
--    Ang AES-256-GCM ciphertext ("v1:<base64>:<base64>:<base64>") ay hindi
--    pwedeng i-store sa date column. Ang backend (crypto.js) ang nag-e-encrypt;
--    ang YYYY-MM-DD validation ay nasa Zod (patient.validation.js).
--    Ang existing rows ay nako-convert sa ISO text (YYYY-MM-DD) — ang
--    decryptRow() sa backend ay nagbabalik ng plaintext as-is kapag hindi
--    ciphertext ang value (legacy/seed tolerant).
-- 2) I-drop ang char_length CHECKs sa appointments.reason at appointments.notes
--    (schema.sql §"FIELD-LEVEL ENCRYPTION PLAYBOOK" item 2): ang base64
--    ciphertext ay mas mahaba sa 500 chars; ang length validation ay lumipat
--    nang BUO sa backend Zod (mas mahigpit pa: length + format + sanitize).
--
-- Idempotent: ligtas i-run nang paulit-ulit (DO blocks na nagche-check muna
-- bago mag-ALTER/DROP). I-run sa Supabase SQL Editor PAGKATAPOS ng 001–002.

-- 1) date_of_birth: date → text (kung hindi pa na-convert).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patients'
      AND column_name = 'date_of_birth'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE public.patients
      ALTER COLUMN date_of_birth TYPE text USING date_of_birth::text;
    RAISE NOTICE '[003] patients.date_of_birth: date → text';
  ELSE
    RAISE NOTICE '[003] patients.date_of_birth ay text na (skip)';
  END IF;
END $$;

-- 2) I-drop ang char_length CHECKs sa appointments.reason / appointments.notes.
--    Inaasahang pangalan (Postgres auto-naming): appointments_reason_check at
--    appointments_notes_check — pero hinahanap dynamically via pg_constraint
--    para hindi mag-fail kung iba ang pangalan o na-drop na.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname AS name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'appointments'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND (
        pg_get_constraintdef(con.oid) LIKE '%char_length(reason%'
        OR pg_get_constraintdef(con.oid) LIKE '%char_length(notes%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', c.name);
    RAISE NOTICE '[003] dropped CHECK constraint: %', c.name;
  END LOOP;
END $$;
