-- database/seeds/doctor_demo_appointments.sql
-- Demo appointments para sa MANUAL Phase 5 (Doctor Portal) testing.
--
-- SINO: d1 = Dr. Maria Elena Villanueva-Santos (doctor@medicacare.ph)
--       d2 = Dr. Rafael Domingo (doctor2@medicacare.ph)
-- LAMAN (bawat doctor):
--   - 09:00 today       → pending    (COMPLETE-VISIT test: notes 10–500 → completed;
--                                     repeat → 409; <10 chars → validation error)
--   - 10:30 today       → confirmed  (spare complete candidate)
--   - 14:00 today       → completed  (+ consultation record → AMEND-NOTES test)
--   - 09:00 next avail  → pending    (NO-SHOW test → patient rebooks the same
--                                     slot; ang date ay auto-computed = susunod
--                                     na araw na may 09:00 availability ang doctor)
--
-- IDEMPOTENT: dine-delete muna ang demo rows (ang FK children ay naka-
-- ON DELETE CASCADE/SET NULL, kaya malinis ang re-run). Ligtas itong
-- i-run nang paulit-ulit sa Supabase SQL Editor.
--
-- TANDAAN: Manila-today aware ((now() at time zone 'Asia/Manila')::date).
-- Kung may tumamang slot sa existing active appointment (uq_appointments_
-- active_slot), ang INSERT ay tahimik na mag-skip (ON CONFLICT DO NOTHING)
-- — tingnan ang verification SELECT sa dulo.

-- 0) Cleanup ng nakaraang demo rows (cascade ang children: medical_records,
--    visit_ratings, notifications, lab_results, medications).
delete from appointments where id in (
  '30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000022',
  '30000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000024',
  '30000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000026',
  '30000000-0000-4000-8000-000000000027', '30000000-0000-4000-8000-000000000028'
);

-- 1) d1 — pending (complete-visit test)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes, created_at)
values
  ('30000000-0000-4000-8000-000000000021',
   '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Manila')::date, time '09:00', time '09:30',
   'Demo: Annual physical examination', '+63 918 445 1120', true,
   'pending', null, now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

-- 2) d1 — confirmed (spare complete candidate)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes, created_at, confirmed_at)
values
  ('30000000-0000-4000-8000-000000000022',
   '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Manila')::date, time '10:30', time '11:00',
   'Demo: Follow-up consultation', '+63 917 998 2345', true,
   'confirmed', null, now() - interval '1 day', now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

-- 3) d1 — completed + consultation record (amend-notes test)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes,
   created_at, confirmed_at, completed_at)
values
  ('30000000-0000-4000-8000-000000000023',
   '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001',
   (now() at time zone 'Asia/Manila')::date, time '14:00', time '14:30',
   'Demo: Skin allergy consultation', '+63 916 210 8877', true,
   'completed',
   'Demo visit notes: patient responding well to treatment. Continue prescribed medication and follow up in two weeks.',
   now() - interval '2 days', now() - interval '1 day', now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

insert into medical_records
  (id, patient_id, doctor_id, appointment_id, visit_date, record_type, title, summary)
select
  '40000000-0000-4000-8000-000000000021',
  a.patient_id, a.doctor_id, a.id, a.appointment_date, 'Consultation',
  'Demo: Skin allergy consultation',
  'Demo visit notes: patient responding well to treatment. Continue prescribed medication and follow up in two weeks.'
from appointments a
where a.id = '30000000-0000-4000-8000-000000000023'
on conflict (id) do nothing;

-- 4) d1 — pending sa SUSUNOD na araw na may 09:00 availability (no-show test)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes, created_at)
values
  ('30000000-0000-4000-8000-000000000024',
   '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
   (select min(d::date)
    from generate_series((now() at time zone 'Asia/Manila')::date + 1,
                         (now() at time zone 'Asia/Manila')::date + 14,
                         interval '1 day') d
    where extract(isodow from d)::int in (
      select w.weekday from doctor_weekly_availability w
      where w.doctor_id = '00000000-0000-4000-8000-000000000001'
        and w.start_time <= time '09:00' and w.end_time >= time '09:30')),
   time '09:00', time '09:30',
   'Demo: No-show test visit', '+63 918 445 1120', true,
   'pending', null, now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

-- 5) d2 — pending (complete-visit test)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes, created_at)
values
  ('30000000-0000-4000-8000-000000000025',
   '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
   (now() at time zone 'Asia/Manila')::date, time '09:00', time '09:30',
   'Demo: Pediatric consultation', '+63 917 998 2345', true,
   'pending', null, now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

-- 6) d2 — confirmed (spare complete candidate)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes, created_at, confirmed_at)
values
  ('30000000-0000-4000-8000-000000000026',
   '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002',
   (now() at time zone 'Asia/Manila')::date, time '10:30', time '11:00',
   'Demo: Well-child check-up', '+63 916 210 8877', true,
   'confirmed', null, now() - interval '1 day', now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

-- 7) d2 — completed + consultation record (amend-notes test)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes,
   created_at, confirmed_at, completed_at)
values
  ('30000000-0000-4000-8000-000000000027',
   '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
   (now() at time zone 'Asia/Manila')::date, time '14:00', time '14:30',
   'Demo: Vaccination follow-up', '+63 918 445 1120', true,
   'completed',
   'Demo visit notes: vaccinations up to date. Child healthy; advise routine follow-up next year.',
   now() - interval '2 days', now() - interval '1 day', now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

insert into medical_records
  (id, patient_id, doctor_id, appointment_id, visit_date, record_type, title, summary)
select
  '40000000-0000-4000-8000-000000000022',
  a.patient_id, a.doctor_id, a.id, a.appointment_date, 'Consultation',
  'Demo: Vaccination follow-up',
  'Demo visit notes: vaccinations up to date. Child healthy; advise routine follow-up next year.'
from appointments a
where a.id = '30000000-0000-4000-8000-000000000027'
on conflict (id) do nothing;

-- 8) d2 — pending sa SUSUNOD na araw na may 09:00 availability (no-show test)
insert into appointments
  (id, patient_id, doctor_id, appointment_date, start_time, end_time,
   reason, contact_number, is_first_visit, status, notes, created_at)
values
  ('30000000-0000-4000-8000-000000000028',
   '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002',
   (select min(d::date)
    from generate_series((now() at time zone 'Asia/Manila')::date + 1,
                         (now() at time zone 'Asia/Manila')::date + 14,
                         interval '1 day') d
    where extract(isodow from d)::int in (
      select w.weekday from doctor_weekly_availability w
      where w.doctor_id = '00000000-0000-4000-8000-000000000002'
        and w.start_time <= time '09:00' and w.end_time >= time '09:30')),
   time '09:00', time '09:30',
   'Demo: No-show test visit', '+63 916 210 8877', true,
   'pending', null, now())
on conflict (doctor_id, appointment_date, start_time)
  where (status in ('pending', 'confirmed')) do nothing;

-- 9) Verification: dapat 8 rows (4 bawat doctor) + 2 records.
select a.id, d.full_name as doctor, p.full_name as patient,
       a.appointment_date, a.start_time, a.status, a.reference_code
from appointments a
join doctors d on d.id = a.doctor_id
join patients p on p.id = a.patient_id
where a.id in (
  '30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000022',
  '30000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000024',
  '30000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000026',
  '30000000-0000-4000-8000-000000000027', '30000000-0000-4000-8000-000000000028'
)
order by a.doctor_id, a.appointment_date, a.start_time;

select id, appointment_id, title
from medical_records
where id in ('40000000-0000-4000-8000-000000000021',
             '40000000-0000-4000-8000-000000000022');
