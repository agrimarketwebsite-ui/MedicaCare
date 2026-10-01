// ============================================================
// Router / app root — MedicaCare
// ============================================================
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrandMark, PageSpinner, useHashRoute, useStore, useIsDesktop, DesktopOnlyNotice } from './shared/components.jsx';

// Route-level code splitting: every screen is its own chunk, loaded on
// demand. The heavy reactbits visuals (gsap/ogl) only ship with the pages
// that actually render them — the app shell stays small.
const Landing = lazy(() => import('./public/Landing.jsx').then(m => ({ default: m.Landing })));
const Register = lazy(() => import('./public/Register.jsx').then(m => ({ default: m.Register })));
const Login = lazy(() => import('./public/Login.jsx').then(m => ({ default: m.Login })));
const AdminLogin = lazy(() => import('./public/AdminLogin.jsx').then(m => ({ default: m.AdminLogin })));
const DoctorLogin = lazy(() => import('./public/DoctorLogin.jsx').then(m => ({ default: m.DoctorLogin })));
const ForgotPassword = lazy(() => import('./public/ForgotPassword.jsx').then(m => ({ default: m.ForgotPassword })));
const ServicesPage = lazy(() => import('./public/ServicesPage.jsx').then(m => ({ default: m.ServicesPage })));
const DoctorsPage = lazy(() => import('./public/DoctorsPage.jsx').then(m => ({ default: m.DoctorsPage })));
const AboutPage = lazy(() => import('./public/AboutPage.jsx').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./public/ContactPage.jsx').then(m => ({ default: m.ContactPage })));
const PrivacyPage = lazy(() => import('./public/PrivacyPage.jsx').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./public/TermsPage.jsx').then(m => ({ default: m.TermsPage })));
const MobileShowcase = lazy(() => import('./public/screens-mobile.jsx').then(m => ({ default: m.MobileShowcase })));
const PatientDashboard = lazy(() => import('./patient/PatientDashboard.jsx').then(m => ({ default: m.PatientDashboard })));
const DoctorListing = lazy(() => import('./patient/DoctorListing.jsx').then(m => ({ default: m.DoctorListing })));
const DoctorAvailability = lazy(() => import('./patient/DoctorAvailability.jsx').then(m => ({ default: m.DoctorAvailability })));
const BookAppointment = lazy(() => import('./patient/BookAppointment.jsx').then(m => ({ default: m.BookAppointment })));
const BookingConfirmation = lazy(() => import('./patient/BookingConfirmation.jsx').then(m => ({ default: m.BookingConfirmation })));
const AppointmentStatus = lazy(() => import('./patient/AppointmentStatus.jsx').then(m => ({ default: m.AppointmentStatus })));
const AppointmentHistory = lazy(() => import('./patient/AppointmentHistory.jsx').then(m => ({ default: m.AppointmentHistory })));
const AppointmentDetails = lazy(() => import('./patient/AppointmentDetails.jsx').then(m => ({ default: m.AppointmentDetails })));
const Profile = lazy(() => import('./patient/Profile.jsx').then(m => ({ default: m.Profile })));
const MedicalRecords = lazy(() => import('./patient/MedicalRecords.jsx').then(m => ({ default: m.MedicalRecords })));
const PatientMessages = lazy(() => import('./patient/PatientMessages.jsx').then(m => ({ default: m.PatientMessages })));
const HelpSupport = lazy(() => import('./patient/HelpSupport.jsx').then(m => ({ default: m.HelpSupport })));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard.jsx').then(m => ({ default: m.AdminDashboard })));
const PatientsMgmt = lazy(() => import('./admin/PatientsMgmt.jsx').then(m => ({ default: m.PatientsMgmt })));
const DoctorsMgmt = lazy(() => import('./admin/DoctorsMgmt.jsx').then(m => ({ default: m.DoctorsMgmt })));
const AppointmentsMgmt = lazy(() => import('./admin/AppointmentsMgmt.jsx').then(m => ({ default: m.AppointmentsMgmt })));
const StoriesMgmt = lazy(() => import('./admin/StoriesMgmt.jsx').then(m => ({ default: m.StoriesMgmt })));
const TicketsMgmt = lazy(() => import('./admin/TicketsMgmt.jsx').then(m => ({ default: m.TicketsMgmt })));
const AdminReports = lazy(() => import('./admin/AdminReports.jsx').then(m => ({ default: m.AdminReports })));
const AdminSettings = lazy(() => import('./admin/AdminSettings.jsx').then(m => ({ default: m.AdminSettings })));
const AdminActivity = lazy(() => import('./admin/AdminActivity.jsx').then(m => ({ default: m.AdminActivity })));
const DoctorDashboard = lazy(() => import('./doctor/DoctorDashboard.jsx').then(m => ({ default: m.DoctorDashboard })));
const DoctorPatients = lazy(() => import('./doctor/DoctorPatients.jsx').then(m => ({ default: m.DoctorPatients })));
const DoctorWeekView = lazy(() => import('./doctor/DoctorWeekView.jsx').then(m => ({ default: m.DoctorWeekView })));
const DoctorFeedback = lazy(() => import('./doctor/DoctorFeedback.jsx').then(m => ({ default: m.DoctorFeedback })));

// Warm the Landing chunk immediately: it is the default route, so its fetch
// should start while the app shell is still parsing instead of waiting for
// the first render's Suspense kick-off (dynamic import caches the promise,
// so the lazy() component above reuses this same request).
import('./public/Landing.jsx');

// ============================================================
// Initial-visit splash — brand mark + spinner circle, centered
// vertically AND horizontally. Shown on every full page load,
// held briefly, then faded out (CSS transition) and unmounted.
// ============================================================
function Splash({ fading }) {
  return (
    <div
      className={`app-splash${fading ? ' splash-fading' : ''}`}
      role="status"
      aria-label="Loading MedicaCare"
    >
      <div className="app-splash-inner">
        <BrandMark size={56} />
        <div className="app-splash-spinner" />
      </div>
    </div>
  );
}

function App() {
  const route = useHashRoute();
  const store = useStore();
  // Staff consoles are desktop-only: on small screens both portals are
  // replaced by a fallback notice (see DesktopOnlyNotice in components.jsx)
  const isDesktop = useIsDesktop();
  // Splash lifecycle: 'shown' -> 'fading' -> 'gone' (then unmounted).
  // First visit only: it runs on the landing page — a full page load that
  // deep-links straight into the patient portal or admin console (or any
  // other page) skips it entirely.
  const [splash, setSplash] = useState(() => {
    const r = (window.location.hash.replace(/^#/, '') || '/').split('?')[0];
    return (r === '/' || r === '' || r === '/landing') ? 'shown' : 'gone';
  });
  useEffect(() => {
    if (splash === 'gone') return;
    const t1 = setTimeout(() => setSplash('fading'), 900);
    const t2 = setTimeout(() => setSplash('gone'), 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [splash === 'gone']);

  // Navigating away from the landing page while the splash is still up
  // (fast click within the 1.3s window) dismisses it immediately — it must
  // never linger over the portal or admin console
  useEffect(() => {
    if (splash === 'gone') return;
    const r = route.split('?')[0];
    if (!(r === '/' || r === '' || r === '/landing')) setSplash('gone');
  }, [route, splash]);

  // Split an optional query string off the hash route (e.g. #/doctors?spec=Cardiology)
  // so deep links from the Landing care finder / department chips can pre-filter pages.
  const [routePath, routeQuery] = route.split('?');
  const queryParams = new URLSearchParams(routeQuery || '');

  // Parse route
  const [path, ...rest] = routePath.split('/').filter(Boolean);
  const first = '/' + (path || '');

  // Sync role to URL for persistence (deferred to next tick to avoid setState-in-render)
  useEffect(() => {
    if (path === 'admin' && store.role !== 'admin') store.setRole('admin');
    else if (path === 'patient' && store.role !== 'patient') store.setRole('patient');
    else if (path === 'doctor' && store.role !== 'doctor') store.setRole('doctor');
  }, [path]);

  let screen;
  if (route === '/' || route === '' || first === '/landing') {
    screen = <Landing />;
  } else if (first === '/register') {
    screen = <Register />;
  } else if (first === '/login') {
    screen = <Login />;
  } else if (first === '/forgot-password') {
    screen = <ForgotPassword />;
  } else if (first === '/mobile') {
    screen = <MobileShowcase />;
  } else if (first === '/services') {
    screen = <ServicesPage />;
  } else if (first === '/doctors') {
    screen = <DoctorsPage initialSpecialty={queryParams.get('spec') || ''} />;
  } else if (first === '/about') {
    screen = <AboutPage />;
  } else if (first === '/contact') {
    screen = <ContactPage />;
  } else if (first === '/privacy') {
    screen = <PrivacyPage />;
  } else if (first === '/terms') {
    screen = <TermsPage />;
  } else if (path === 'patient') {
    // Route guard — the patient portal requires a patient session.
    if (!store.patientSession) {
      screen = <Login />;
    } else {
      const sub = rest[0];
      const arg = rest[1];
      if (sub === 'dashboard') screen = <PatientDashboard />;
      else if (sub === 'doctors') screen = <DoctorListing />;
      else if (sub === 'availability') screen = <DoctorAvailability doctorId={arg} />;
      else if (sub === 'book') screen = <BookAppointment />;
      else if (sub === 'confirmation') screen = <BookingConfirmation />;
      else if (sub === 'status') screen = <AppointmentStatus />;
      else if (sub === 'history') screen = <AppointmentHistory />;
      else if (sub === 'appointment') screen = <AppointmentDetails apptId={arg} />;
      else if (sub === 'profile') screen = <Profile />;
      else if (sub === 'records') screen = <MedicalRecords />;
      else if (sub === 'messages') screen = <PatientMessages />;
      else if (sub === 'help') screen = <HelpSupport />;
      else screen = <PatientDashboard />;
    }
  } else if (path === 'admin') {
    const sub = rest[0];
    // Route guard — the staff console requires an admin session; the staff
    // login itself is unlinked from the public site (URL is shared internally).
    if (!isDesktop) {
      screen = <DesktopOnlyNotice role="admin" />;
    } else if (sub === 'login') {
      screen = <AdminLogin />;
    } else if (!store.adminSession) {
      screen = <AdminLogin />;
    } else if (sub === 'dashboard') screen = <AdminDashboard />;
    else if (sub === 'patients') screen = <PatientsMgmt />;
    else if (sub === 'doctors') screen = <DoctorsMgmt />;
    else if (sub === 'appointments') screen = <AppointmentsMgmt />;
    else if (sub === 'stories') screen = <StoriesMgmt />;
    else if (sub === 'tickets') screen = <TicketsMgmt />;
    else if (sub === 'reports') screen = <AdminReports />;
    else if (sub === 'activity') screen = <AdminActivity />;
    else if (sub === 'settings') screen = <AdminSettings />;
    else screen = <AdminDashboard />;
  } else if (path === 'doctor') {
    const sub = rest[0];
    // Route guard — the doctor portal requires a doctor session; the doctor
    // login itself is unlinked from the public site (shared internally).
    if (!isDesktop) {
      screen = <DesktopOnlyNotice role="doctor" />;
    } else if (sub === 'login') {
      screen = <DoctorLogin />;
    } else if (!store.doctorSession) {
      screen = <DoctorLogin />;
    } else if ((window.DOCTORS || []).length > 0 && !window.findDoctor(store.doctorSession.doctorId)) {
      // Phase 2: ang directory ay empty pa (Phase 5 pa ang doctors API) — ang
      // check na ito ay gumagana lang kapag may laman ang directory (tulad ng
      // original intent: session ng doctor na tinanggal ng Admin console).
      // The login screen clears the stale session in an effect.
      screen = <DoctorLogin removed />;
    } else if (sub === 'patients') screen = <DoctorPatients />;
    else if (sub === 'week') screen = <DoctorWeekView />;
    else if (sub === 'feedback') screen = <DoctorFeedback />;
    else screen = <DoctorDashboard />;
  } else {
    screen = <Landing />;
  }

  // set a screen label per top-level route for comments
  const label = route.replace(/^\//, '') || 'landing';
  return (
    <div data-screen-label={label}>
      {splash !== 'gone' && <Splash fading={splash === 'fading'} />}
      <Suspense fallback={<PageSpinner />}>{screen}</Suspense>
    </div>
  );
}

export default App;

