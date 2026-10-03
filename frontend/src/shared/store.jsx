// store.jsx — split from components.jsx (layered shared UI)
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import brandLogo from '../assets/brand_logo.png';
import AnimatedContent from './reactbits/AnimatedContent.jsx';
import { onUnauthorized, bootstrapSession, setNotify, api, apiOptional, clearAccessToken, getProfile, listFamily } from './api.js';

// ---------- App-wide store (kept simple, in-memory + localStorage for appointments/role) ----------
const StoreCtx = createContext(null);

function useStore() { return useContext(StoreCtx); }

// Seed-data purge — the frontend no longer ships fictional demo data, but
// browsers that ran the earlier prototype still carry seeded rows in
// localStorage. Strip every row whose id matches an old seed pattern on
// startup (idempotent: real user-created rows use timestamp ids and survive).
const SEED_ID_PURGE = [
  ['nmc.appointments', (id) => /^apT/.test(id) || /^ap\d{1,2}$/.test(id)],
  ['nmc.ratings', (id) => /^demo-/.test(id)],
  ['nmc.testimonials', (id) => /^tDemo/.test(id)],
  ['nmc.tickets', (id) => /^tkt[1-4]$/.test(id)],
  ['nmc.family', (id) => /^fam[12]$/.test(id)],
  ['nmc.labs', (id) => /^lab[1-3]$/.test(id)],
  ['nmc.meds', (id) => /^med[1-3]$/.test(id)],
  // '/^act/' catches BOTH the seed rows (act1–act8) and the runtime entries
  // generated during demo sessions (act_<timestamp>_<rand>) — new activity
  // entries use the 'al_' prefix so they survive this purge
  ['nmc.activity', (id) => /^act/.test(id)],
  ['nmc.users', (id) => id === 'udoctor' || /^p\d{1,2}$/.test(id)],
];

function purgeSeedRows() {
  for (const [key, isSeed] of SEED_ID_PURGE) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(saved)) continue;
      const cleaned = saved.filter(item => !item || !isSeed(String(item.id)));
      if (cleaned.length !== saved.length) localStorage.setItem(key, JSON.stringify(cleaned));
    } catch { /* corrupted storage — leave as-is */ }
  }
  // Seed identities/sessions — no longer valid without the demo accounts
  const isSeedSession = (v) => v && typeof v === 'object'
    && (/^p\d{1,2}$/.test(String(v.id)) || /^d\d{1,2}$/.test(String(v.doctorId)));
  try {
    if (isSeedSession(JSON.parse(localStorage.getItem('nmc.currentPatient')))) localStorage.removeItem('nmc.currentPatient');
    if (isSeedSession(JSON.parse(localStorage.getItem('nmc.patientSession')))) localStorage.removeItem('nmc.patientSession');
    if (isSeedSession(JSON.parse(localStorage.getItem('nmc.doctorSession')))) localStorage.removeItem('nmc.doctorSession');
  } catch { /* leave as-is */ }
}

// Rename migration: accounts/identities saved before the MedicaCare rename
// still carry the old @northgate-medical.ph domain — remap them on load so
// demo logins and registered accounts keep working without clearing storage.
function migratedEmail(user) {
  return (user && typeof user.email === 'string' && user.email.endsWith('@northgate-medical.ph'))
    ? { ...user, email: user.email.replace('@northgate-medical.ph', '@medicacare.ph') }
    : user;
}

// Phase 3 — API doctor shape → frontend shape (tugma sa inaasahan ng
// DoctorsPage/Landing: d.name, d.specialty (name), d.exp, d.fee, d.photo,
// d.rating / d.ratingCount mula sa v_doctor_rating_averages).
function toFrontendDoctor(d) {
  return {
    id: d.id,
    name: d.full_name,
    specialty: d.specialty_name,
    specialty_id: d.specialty_id,
    status: d.status,
    exp: d.years_of_experience,
    fee: Number(d.consultation_fee),
    room: d.room,
    gender: d.gender,
    photo: d.photo_url,
    rating: d.avg_rating,
    ratingCount: d.rating_count,
  };
}

function StoreProvider({ children }) {
  purgeSeedRows();
  const [role, setRole] = useState(() => localStorage.getItem('nmc.role') || 'patient');
  const [appointments, setAppointments] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.appointments'));
      if (Array.isArray(saved)) return saved;
    } catch { /* fall through */ }
    return [];
  });
  const [doctors, setDoctors] = useState(window.DOCTORS);
  // Phase 3 — specialties mula sa DB (mga pangalan lang; ang reactive source
  // ay ang store, naka-sync sa window.SPECIALTIES para sa direktang imports)
  const [specialties, setSpecialties] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.specialties'));
      if (Array.isArray(saved) && saved.length) {
        window.SPECIALTIES.push(...saved.filter((s) => !window.SPECIALTIES.includes(s)));
        return saved;
      }
    } catch { /* fall through */ }
    return [];
  });
  const [patients, setPatients] = useState(window.PATIENTS);
  const [pendingBooking, setPendingBooking] = useState(null); // {doctorId, date, time}
  const [lastBookingId, setLastBookingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [users, setUsers] = useState(() => {
    // LEGACY (Phase 2): ang Login/Register ay hindi na gumagamit nito (API na).
    // Nananatili lang para sa admin "grant doctor portal access" flow — ito ay
    // ia-wire sa backend sa Phase 6 (admin console), at doon tuluyang tatanggalin.
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.users'));
      if (Array.isArray(saved)) return saved.map(migratedEmail);
    } catch { /* fall through */ }
    return [];
  });
  // Identity of the logged-in patient (hydrated from the backend session
  // once wired; neutral placeholder identity until then)
  const [currentPatient, setCurrentPatient] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.currentPatient'));
      if (saved && saved.id) return migratedEmail(saved);
    } catch { /* fall through */ }
    return window.CURRENT_PATIENT;
  });
  // API-backed auth sessions (Phase 1 plumbing — ang login/logout API calls ay Phase 2).
  // Ang session ay PROFILE lang mula sa API response — WALANG token dito:
  // ang access token ay nasa memory lang (api.js), ang refresh token ay
  // httpOnly cookie. Profile cache lang ang naka-persist sa localStorage
  // (FRONTEND_SECURITY_AUDIT — token storage decision).
  const [patientSession, setPatientSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nmc.patientSession')) || null; } catch { return null; }
  });
  const [adminSession, setAdminSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nmc.adminSession')) || null; } catch { return null; }
  });
  // Doctor portal session — doctors log in to see their own schedule and
  // write their own visit notes (attributed to them, not encoded by staff)
  const [doctorSession, setDoctorSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nmc.doctorSession')) || null; } catch { return null; }
  });
  // Visit ratings — one per completed appointment (submitted from the patient
  // portal). Persisted; the history comes from the database (visit_ratings)
  // via the backend.
  const [ratings, setRatings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.ratings'));
      if (Array.isArray(saved)) return saved;
    } catch { /* fall through */ }
    return [];
  });
  // Public testimonials — patient-submitted (portal), staff-moderated before
  // they appear on the public website. Persisted; approved stories are
  // served by the backend from patient_stories in the database.
  const [testimonials, setTestimonials] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.testimonials'));
      if (Array.isArray(saved)) return saved;
    } catch { /* fall through */ }
    return [];
  });

  // Clinic info + appointment preferences — persisted, and clinic info is
  // synced live to window.HOSPITAL so the public website reflects admin edits
  const [clinic, setClinic] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.clinic'));
      if (saved && saved.name) { Object.assign(window.HOSPITAL, saved); return saved; }
    } catch { /* fall through to seed */ }
    return { name: window.HOSPITAL.name, phone: window.HOSPITAL.phone, email: window.HOSPITAL.email, address: window.HOSPITAL.address };
  });
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.prefs'));
      if (saved) return saved;
    } catch { /* fall through to seed */ }
    return { emailNewAppointments: true, remindPatients: true, autoConfirm: false, slotInterval: '30' };
  });
  // Family members (proxy booking) — the patient can book appointments on
  // their behalf from the booking form; managed on the Profile page.
  // Phase 4: ang database (GET /api/patients/me/family) ang source of truth —
  // hindi na ito pini-persist sa localStorage.
  const [familyMembers, setFamilyMembers] = useState([]);
  // Phase 4 — patient profile (GET /api/patients/me). Best-effort hydration
  // tulad ng public data: tahimik kapag offline, at hindi nakakasira sa
  // public hydration o sa window.DOCTORS/SPECIALTIES sync.
  const [profile, setProfile] = useState(null);
  const refreshProfile = useCallback(async () => {
    try {
      const p = await getProfile();
      setProfile(p || null);
      return p || null;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    if (!patientSession) { setProfile(null); setFamilyMembers([]); return; }
    let cancelled = false;
    getProfile().then((p) => { if (!cancelled && p) setProfile(p); }).catch(() => {});
    listFamily().then((f) => { if (!cancelled && Array.isArray(f)) setFamilyMembers(f); }).catch(() => {});
    return () => { cancelled = true; };
  }, [patientSession]);
  // Support tickets — portal "Message the clinic" submissions that land on
  // the admin console's Patient messages page; persisted like appointments.
  // `thread` carries the conversation AFTER the first message (staff replies
  // + patient follow-ups, so the loop is two-way). Older saved tickets only
  // carry the legacy reply field — synthesized into a thread on load.
  const [tickets, setTickets] = useState(() => {
    const withThread = (t) => {
      if (t.thread || !t.reply) return t;
      return { ...t, thread: [{ id: t.id + '-s1', from: 'staff', text: t.reply, date: t.repliedAt || t.createdAt }] };
    };
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.tickets'));
      if (Array.isArray(saved)) return saved.map(withThread);
    } catch { /* fall through */ }
    return [];
  });
  // Lab results + medications — staff-encoded (Admin console → Patients →
  // Labs & medications) and shown on the patient's Medical Records page.
  // Persisted; rows come from the database (lab_results / medications).
  const [labs, setLabs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.labs'));
      if (Array.isArray(saved)) return saved;
    } catch { /* fall through */ }
    return [];
  });
  const [meds, setMeds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.meds'));
      if (Array.isArray(saved)) return saved;
    } catch { /* fall through */ }
    return [];
  });
  // Patient-side reminder preferences (Profile page → Notifications & reminders)
  const [patientPrefs, setPatientPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.patientPrefs'));
      if (saved) return saved;
    } catch { /* fall through to defaults */ }
    return { emailReminders: true, portalNotifs: true };
  });
  // Activity log — staff/doctor/portal actions surfaced on the admin Activity
  // page. Persisted; real actions append at runtime (database-backed later).
  const [activity, setActivity] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmc.activity'));
      if (Array.isArray(saved)) return saved;
    } catch { /* fall through */ }
    return [];
  });
  const pushActivity = useCallback((actor, action, detail) => {
    setActivity(prev => [
      // 'al_' prefix — IDs starting with 'act' belong to the pre-backend demo
      // era and are stripped by purgeSeedRows() on startup
      { id: 'al_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), actor, action, detail: detail || '', at: Date.now() },
      ...prev,
    ].slice(0, 20));
  }, []);

  // Phase 1 plumbing wiring (isang beses sa mount):
  //  - network-error toasts mula sa api.js → pushToast
  //  - tuluyang 401 (refresh nabigo) → logout lahat ng sessions
  //  - silent refresh sa boot → i-restore ang session nang walang login
  useEffect(() => {
    setNotify((t) => pushToast(t));
    onUnauthorized(() => {
      setPatientSession(null);
      setAdminSession(null);
      setDoctorSession(null);
      setCurrentPatient(window.CURRENT_PATIENT);
      pushToast({ kind: 'error', title: 'Session expired', msg: 'Please log in again.' });
    });
    let cancelled = false;
    bootstrapSession().then((data) => {
      if (!cancelled && data) applyApiSession(data.role, data.profile);
    });
    // Phase 3 — public data hydration (walang login na kailangan). Best-effort:
    // apiOptional ay tahimik kapag offline — mananatili ang cached/empty states.
    apiOptional('/settings/public', { auth: false }).then((data) => {
      if (cancelled || !data) return;
      if (data.clinic) {
        setClinic({
          name: data.clinic.name || '',
          short: data.clinic.short_name || '',
          tagline: data.clinic.tagline || '',
          phone: data.clinic.phone || '',
          email: data.clinic.email || '',
          address: data.clinic.address || '',
          hours: data.clinic.hours || null,
        });
      }
      if (data.preferences) {
        setPrefs((p) => ({
          ...p,
          autoConfirm: data.preferences.auto_confirm_appointments,
          slotInterval: String(data.preferences.slot_interval_minutes ?? p.slotInterval),
          emailNewAppointments: data.preferences.email_admins_on_new_appointment,
          remindPatients: data.preferences.remind_patients,
        }));
      }
    });
    apiOptional('/doctors?limit=100', { auth: false }).then((data) => {
      if (cancelled || !data) return;
      setDoctors((data.doctors || []).map(toFrontendDoctor));
    });
    apiOptional('/doctors/specialties', { auth: false }).then((data) => {
      if (cancelled || !data) return;
      setSpecialties((data.specialties || []).map((s) => s.name));
    });
    apiOptional('/stories?limit=10', { auth: false }).then((data) => {
      if (cancelled || !data) return;
      setTestimonials((data.stories || []).map((s) => ({
        id: s.id,
        quote: s.quote,
        displayName: s.display_name,
        status: 'approved',
        created_at: s.created_at,
      })));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { localStorage.setItem('nmc.role', role); }, [role]);
  useEffect(() => { localStorage.setItem('nmc.appointments', JSON.stringify(appointments)); }, [appointments]);
  useEffect(() => { localStorage.setItem('nmc.users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('nmc.currentPatient', JSON.stringify(currentPatient)); }, [currentPatient]);
  useEffect(() => { localStorage.setItem('nmc.patientSession', JSON.stringify(patientSession)); }, [patientSession]);
  useEffect(() => { localStorage.setItem('nmc.adminSession', JSON.stringify(adminSession)); }, [adminSession]);
  useEffect(() => { localStorage.setItem('nmc.doctorSession', JSON.stringify(doctorSession)); }, [doctorSession]);
  useEffect(() => {
    Object.assign(window.HOSPITAL, clinic);
    try { localStorage.setItem('nmc.clinic', JSON.stringify(clinic)); } catch { /* private mode */ }
  }, [clinic]);
  // Phase 3 — i-sync ang window.DOCTORS / window.SPECIALTIES para sa mga
  // direktang import (findDoctor at iba pa); ang reactive source ay ang store.
  // Tandaan: kopyahin muna — ang initial state AY ang window array mismo.
  useEffect(() => {
    const next = [...doctors];
    window.DOCTORS.length = 0;
    window.DOCTORS.push(...next);
  }, [doctors]);
  useEffect(() => {
    const next = [...specialties];
    window.SPECIALTIES.length = 0;
    window.SPECIALTIES.push(...next);
    try { localStorage.setItem('nmc.specialties', JSON.stringify(next)); } catch { /* private mode */ }
  }, [specialties]);
  useEffect(() => {
    try { localStorage.setItem('nmc.prefs', JSON.stringify(prefs)); } catch { /* private mode */ }
  }, [prefs]);
  useEffect(() => { localStorage.setItem('nmc.tickets', JSON.stringify(tickets)); }, [tickets]);
  useEffect(() => { localStorage.setItem('nmc.labs', JSON.stringify(labs)); }, [labs]);
  useEffect(() => { localStorage.setItem('nmc.meds', JSON.stringify(meds)); }, [meds]);
  useEffect(() => {
    try { localStorage.setItem('nmc.patientPrefs', JSON.stringify(patientPrefs)); } catch { /* private mode */ }
  }, [patientPrefs]);
  useEffect(() => {
    try { localStorage.setItem('nmc.activity', JSON.stringify(activity)); } catch { /* private mode */ }
  }, [activity]);
  useEffect(() => { localStorage.setItem('nmc.ratings', JSON.stringify(ratings)); }, [ratings]);
  useEffect(() => { localStorage.setItem('nmc.testimonials', JSON.stringify(testimonials)); }, [testimonials]);

  const pushToast = useCallback((t) => {
    const id = 'tst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    setToasts(prev => [...prev, { id, kind: 'success', ...t }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), t.duration || 3800);
  }, []);
  const dismissToast = useCallback((id) => setToasts(prev => prev.filter(x => x.id !== id)), []);

  // Login = profile mula sa API response (Phase 2: POST /api/auth/login).
  // Tandaan: hindi dito dumadaan ang tokens — nasa api.js (memory) sila.
  // Phase 2 — server logout: i-revoke ang refresh sessions sa backend.
  // Best-effort: kahit mag-fail (offline), ang local session ay naka-clear pa rin.
  const serverLogout = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    clearAccessToken();
  }, []);

  const loginPatient = useCallback((profile) => {
    setPatientSession({ ...profile, at: Date.now() });
    setCurrentPatient(profile);
  }, []);
  const logoutPatient = useCallback(() => {
    serverLogout();
    setPatientSession(null);
    // Reset to the seeded demo identity so the portal still renders after logout
    setCurrentPatient(window.CURRENT_PATIENT);
  }, [serverLogout]);
  const loginAdmin = useCallback((profile) => {
    setAdminSession({ ...profile, at: Date.now() });
  }, []);
  const logoutAdmin = useCallback(() => { serverLogout(); setAdminSession(null); }, [serverLogout]);
  const loginDoctor = useCallback((profile) => setDoctorSession({ ...profile, at: Date.now() }), []);
  const logoutDoctor = useCallback(() => { serverLogout(); setDoctorSession(null); }, [serverLogout]);
  // I-route ang API profile sa tamang session base sa role (Phase 2 contract:
  // refresh/login responses ay may { profile, role }).
  const applyApiSession = useCallback((role, profile) => {
    if (!profile) return;
    if (role === 'admin') setAdminSession({ ...profile, at: Date.now() });
    else if (role === 'doctor') {
      // Tulad ng patient `name` fix: ang API profile ay may `doctor_id`
      // (snake_case), pero ang App.jsx guard at DoctorLogin ay umaasa sa
      // `doctorId` (camelCase). Kung hindi ito i-normalize dito, pagkatapos
      // ng F5 (silent refresh) ay mawawala ang doctorId sa session at
      // ibabalik ang user sa doctor login page kahit valid pa ang session.
      setDoctorSession({
        ...profile,
        doctorId: profile.doctorId || profile.doctor_id,
        name: profile.name || profile.email || '',
        at: Date.now(),
      });
    }
    else {
      setPatientSession({ ...profile, at: Date.now() });
      // Ang API profile ay may full_name, pero ang sidebar (layout.jsx) ay
      // umaasa sa `name` — katulad ng ginagawa ng Login.jsx (name:
      // profile.full_name). Kung hindi ito i-normalize dito, pagkatapos ng
      // F5 (silent refresh) ay mawawala ang pangalan sa sidebar kahit
      // naka-login pa rin. Ang spread ay pinapanatili ang full_name para sa
      // ibang gumagamit nito.
      setCurrentPatient({ ...profile, name: profile.name || profile.full_name || '' });
    }
  }, []);

  const store = {
    role, setRole,
    appointments, setAppointments,
    ratings, setRatings,
    testimonials, setTestimonials,
    doctors, setDoctors,
    specialties, setSpecialties,
    patients, setPatients,
    pendingBooking, setPendingBooking,
    lastBookingId, setLastBookingId,
    users, setUsers,
    currentPatient, setCurrentPatient,
    patientSession, loginPatient, logoutPatient,
    adminSession, loginAdmin, logoutAdmin,
    doctorSession, loginDoctor, logoutDoctor,
    clinic, setClinic,
    prefs, setPrefs,
    familyMembers, setFamilyMembers,
    profile, refreshProfile,
    tickets, setTickets,
    labs, setLabs, meds, setMeds,
    patientPrefs, setPatientPrefs,
    activity, pushActivity,
    pushToast, toasts, dismissToast,
  };
  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export { StoreCtx, useStore, migratedEmail, StoreProvider };


