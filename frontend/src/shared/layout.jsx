successfully downloaded text file (SHA: e926443b8861e6e2836463d0aa7ac3d6e9fa342a)
// layout.jsx — split from components.jsx (layered shared UI)
import { Fragment, useEffect, useRef, useState } from 'react';
import brandLogo from '../assets/brand_logo.png';
import './data.js';
import AnimatedContent from './reactbits/AnimatedContent.jsx';
import { navigate, useHashRoute } from './hooks.js';
import { Icon } from './icons.jsx';
import { useStore } from './store.jsx';
import { DoctorAvatar, PatientAvatar, ToastLayer } from './ui.jsx';

// Full-page fallback for the Admin console and Doctor portal on small
// screens: those consoles are dense tables/layouts built for desktop, so
// instead of a broken mobile squeeze the portals are gated entirely.
// App.jsx renders this in place of any /admin/* or /doctor/* route.
function DesktopOnlyNotice({ role = 'admin' }) {
  const label = role === 'doctor' ? 'The Doctor portal' : 'The Admin console';
  return (
    <div className="desktop-only" role="status">
      <BrandMark size={44} />
      <div className="desktop-only-icon">
        <Icon name="monitor" size={24} />
      </div>
      <h1>Desktop only</h1>
      <p>
        {label} is designed for desktop screens. Please open it on a computer,
        or widen your browser window to at least 720px.
      </p>
    </div>
  );
}

// ---------- Brand logo mark ----------
// Renders the MedicaCare logo inside the brand tile; falls back to the "M"
// letter when the image is missing or fails to load (e.g. offline demo).
function BrandMark({ className = 'sidebar-brand-mark', size, alt = 'MedicaCare logo' }) {
  const [failed, setFailed] = useState(false);
  // The blue tile is only shown behind the letter fallback — the logo image
  // itself renders as-is with no background behind it.
  const cls = failed ? `${className} brand-mark-fallback` : className;
  return (
    <div className={cls} style={size ? { width: size, height: size } : undefined}>
      {failed ? 'M' : <img src={brandLogo} alt={alt} onError={() => setFailed(true)} />}
    </div>
  );
}

// ---------- Sidebar & Topbar ----------
function Sidebar({ role, current }) {
  const store = useStore();
  const patientNav = [
    { id: 'dashboard',    label: 'Dashboard',     icon: 'layout-dashboard', route: '/patient/dashboard' },
    { id: 'doctors',      label: 'Find a doctor', icon: 'stethoscope',      route: '/patient/doctors' },
    { id: 'book',         label: 'Book appointment', icon: 'calendar-plus', route: '/patient/book' },
    { id: 'history',      label: 'My appointments', icon: 'calendar-check', route: '/patient/history' },
    { id: 'records',      label: 'Medical records', icon: 'file-text',     route: '/patient/records' },
  ];
  const patientNav2 = [
    { id: 'profile',      label: 'Profile',       icon: 'user-round',   route: '/patient/profile' },
    { id: 'messages',     label: 'My messages',   icon: 'inbox',        route: '/patient/messages' },
    { id: 'help',         label: 'Help & support',icon: 'life-buoy',    route: '/patient/help' },
  ];
  const adminNav = [
    { id: 'a-dashboard',  label: 'Dashboard',     icon: 'layout-dashboard', route: '/admin/dashboard' },
    // Live pending count from the store instead of a hardcoded number —
    // the badge always means something real (audit-002 #20)
    { id: 'appointments', label: 'Appointments',  icon: 'calendar-days',    route: '/admin/appointments',
      count: store.appointments.filter(a => a.status === 'pending').length },
    { id: 'patients',     label: 'Patients',      icon: 'users-round',      route: '/admin/patients' },
    { id: 'doctors',      label: 'Doctors',       icon: 'stethoscope',      route: '/admin/doctors' },
    // Live pending-story count — same "badge means real state" rule as the
    // appointments badge above
    { id: 'stories',      label: 'Patient stories', icon: 'message-square', route: '/admin/stories',
      count: store.testimonials.filter(t => t.status === 'pending').length },
    // Live open-message count — same "badge means real state" rule as the
    // other admin badges
    { id: 'tickets',      label: 'Patient messages', icon: 'inbox',      route: '/admin/tickets',
      count: (store.tickets || []).filter(t => t.status === 'open').length },
    { id: 'reports',      label: 'Reports',       icon: 'bar-chart-3',      route: '/admin/reports' },
    { id: 'a-activity',   label: 'Activity log',  icon: 'history',          route: '/admin/activity' },
  ];
  const adminNav2 = [
    { id: 'settings',     label: 'Settings',      icon: 'settings',    route: '/admin/settings' },
  ];
  // Doctor portal — doctors see only their own schedule and patients.
  // Live badge: today's appointment count — same "badge means real state"
  // rule as the admin console, so the sidebar isn't a dead two-item list.
  const dNow = new Date();
  const dToday = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;
  const doctorNav = [
    { id: 'd-dashboard',  label: "Today's schedule", icon: 'calendar-check', route: '/doctor/dashboard',
      count: store.appointments.filter(a => a.doctorId === ((store.doctorSession || {}).doctorId) && a.date === dToday).length },
    { id: 'd-week',       label: 'This week',        icon: 'calendar-days',  route: '/doctor/week' },
    { id: 'd-patients',   label: 'My patients',      icon: 'users-round',    route: '/doctor/patients' },
    { id: 'd-feedback',   label: 'Patient feedback', icon: 'star',           route: '/doctor/feedback' },
  ];

  let primary, secondary;
  if (role === 'admin') { primary = adminNav; secondary = adminNav2; }
  else if (role === 'doctor') { primary = doctorNav; secondary = []; }
  else { primary = patientNav; secondary = patientNav2; }

  const doctorRec = role === 'doctor'
    ? window.findDoctor(store.doctorSession && store.doctorSession.doctorId)
    : null;
  const me = role === 'admin'
    ? window.CURRENT_ADMIN
    : role === 'doctor'
      ? (doctorRec || { name: 'Doctor', specialty: '—' })
      : (store.currentPatient || window.CURRENT_PATIENT);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark />
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">MedicaCare</div>
          <div className="sidebar-brand-sub">{role === 'admin' ? 'Admin console' : role === 'doctor' ? 'Doctor portal' : 'Patient portal'}</div>
        </div>
      </div>
      <div className="sidebar-nav">
        <div className="sidebar-nav-label">Main</div>
        {primary.map(item => (
          // Real <button> (audit-002 #1): puts the nav in the Tab order and
          // gives Enter/Space activation for free; the .sidebar-item CSS
          // reset keeps the visuals identical to the old clickable div
          <button key={item.id} type="button"
               className={'sidebar-item' + (current === item.id ? ' active' : '')}
               onClick={() => navigate(item.route)}>
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.count != null && <span className="badge-count">{item.count}</span>}
          </button>
        ))}
        {secondary.length > 0 && (
          <Fragment>
            <div className="sidebar-nav-label">Account</div>
            {secondary.map(item => (
              <button key={item.id} type="button"
                   className={'sidebar-item' + (current === item.id ? ' active' : '')}
                   onClick={() => navigate(item.route)}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </Fragment>
        )}
      </div>
      <div className="sidebar-footer">
        {/* Admin card matches the portal: photo avatar with initials fallback
            (same behavior as PatientAvatar/DoctorAvatar) instead of a bare
            initials circle */}
        <PatientAvatar person={me} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={me.name}>{me.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{role === 'admin' ? me.role : role === 'doctor' ? me.specialty : 'Patient'}</div>
        </div>
        <button className="btn-icon" title="Log out" aria-label="Log out" onClick={() => {
          // Clear the session for the active console, then bounce to its own login
          if (role === 'admin') { store.logoutAdmin(); navigate('/admin/login'); }
          else if (role === 'doctor') { store.logoutDoctor(); navigate('/doctor/login'); }
          else { store.logoutPatient(); navigate('/login'); }
        }}>
          <Icon name="log-out" size={16} />
        </button>
      </div>
    </aside>
  );
}

function Topbar({ onMenuClick }) {
  const store = useStore();
  const route = useHashRoute();
  const [notifOpen, setNotifOpen] = useState(false);
  // Read state persists per appointment id (localStorage), so "Mark all as
  // read" survives reloads — a NEW appointment id re-triggers the unread dot
  const [notifReadIds, setNotifReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nmc.notifReadIds')) || []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('nmc.notifReadIds', JSON.stringify(notifReadIds)); }, [notifReadIds]);
  const notifRef = useRef(null);

  const isAdmin = route.startsWith('/admin');
  // Doctor portal: notifications come from the doctor's own appointments;
  // the patient Help button is portal-only and hidden for staff roles
  const isDoctor = route.startsWith('/doctor');

  // Page context in the topbar — without it the strip is an empty 60px band
  // on every console page (a leftover that reads as unfinished template UI).
  // Label mirrors the sidebar's own wording so the two never disagree.
  const sub = route.split('?')[0].split('/').filter(Boolean)[1] || '';
  const pageTitle =
    isDoctor && sub === 'dashboard' ? "Today's schedule"
    : ({
      dashboard: 'Dashboard', appointments: 'Appointments', patients: 'Patients',
      doctors: 'Doctors', stories: 'Patient stories', tickets: 'Patient messages',
      reports: 'Reports', activity: 'Activity log', settings: 'Settings',
      book: 'Book appointment', availability: 'Availability', history: 'My appointments',
      status: 'Appointment status', appointment: 'Appointment details', records: 'Medical records',
      messages: 'My messages', profile: 'Profile', help: 'Help & support', week: 'This week', feedback: 'Patient feedback',
    })[sub] || '';

  // Close the notifications dropdown on outside click or Escape
  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  // Simulated fetch — skeleton rows for 600ms every time the dropdown opens,
  // same loading pattern as the admin list pages
  const [notifLoading, setNotifLoading] = useState(false);
  useEffect(() => {
    if (!notifOpen) return;
    setNotifLoading(true);
    const t = setTimeout(() => setNotifLoading(false), 600);
    return () => clearTimeout(t);
  }, [notifOpen]);

  // Prototype notifications derived from recent appointments
  const meId = (store.currentPatient || window.CURRENT_PATIENT).id;
  const appts = isAdmin
    ? store.appointments
    : isDoctor
      ? store.appointments.filter(a => a.doctorId === (store.doctorSession || {}).doctorId)
      : store.appointments.filter(a => a.patientId === meId);
  const notifIcon = { pending: 'clock', confirmed: 'calendar-check', completed: 'check-circle-2', cancelled: 'calendar-x', 'no-show': 'user-x' };
  const notifications = appts.slice(0, 4).map(a => {
    const doc = window.findDoctor(a.doctorId);
    return {
      id: a.id,
      icon: notifIcon[a.status] || 'calendar-days',
      title: a.status === 'pending' ? 'Appointment request received'
        : a.status === 'confirmed' ? 'Appointment confirmed'
        : a.status === 'completed' ? 'Visit completed'
        : a.status === 'no-show' ? 'Appointment marked as no-show'
        : 'Appointment cancelled',
      msg: `${doc ? doc.name : 'Your doctor'} • ${window.formatDate(a.date)} at ${a.time}`,
    };
  });
  const hasUnread = notifications.some(n => !notifReadIds.includes(n.id));

  // Clicking a notification opens the related appointment (and marks it read).
  // Staff consoles route to their own queues instead of a patient detail page.
  const openNotification = (n) => {
    setNotifReadIds(ids => (ids.includes(n.id) ? ids : [...ids, n.id]));
    setNotifOpen(false);
    if (isAdmin) navigate('/admin/appointments');
    else if (isDoctor) navigate('/doctor/dashboard');
    else navigate('/patient/appointment/' + n.id);
  };

  return (
    <div className="topbar">
      {onMenuClick && (
        <button className="btn-icon mobile-menu-btn" title="Open menu" aria-label="Open menu" onClick={onMenuClick}>
          <Icon name="menu" size={20} />
        </button>
      )}
      {pageTitle && <div className="topbar-title">{pageTitle}</div>}
      <div className="topbar-right">
        <div className="notif-wrap" ref={notifRef}>
          <button className="btn-icon" title="Notifications" aria-label="Notifications" aria-haspopup="true" aria-expanded={notifOpen} onClick={() => setNotifOpen(o => !o)}>
            <Icon name="bell" size={18} />
            {hasUnread && notifications.length > 0 && <span className="dot" />}
          </button>
          {notifOpen && (
            <div className="notif-panel">
              <div className="notif-head">
                <span>Notifications</span>
                <button className="btn btn-link" disabled={notifLoading || !hasUnread} onClick={() => setNotifReadIds(ids => [...ids, ...notifications.map(n => n.id)].slice(-200))}>Mark all as read</button>
              </div>
              {notifLoading ? (
                /* Skeleton rows mirroring the notif-item layout (icon + 2 lines) */
                <div aria-hidden="true">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="notif-item notif-skel">
                      <span className="notif-icon skel" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="skel" style={{ width: '55%', height: 11, marginBottom: 6 }} />
                        <div className="skel" style={{ width: '82%', height: 10 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="notif-empty">You're all caught up: no notifications yet.</div>
              ) : notifications.map(n => (
                <button
                  type="button"
                  key={n.id}
                  className="notif-item notif-link"
                  onClick={() => openNotification(n)}
                  title="Open appointment"
                >
                  <span className="notif-icon"><Icon name={n.icon} size={15} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-msg">{n.msg}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Help & support is patient-portal only — hidden in staff consoles */}
        {!isAdmin && !isDoctor && (
          <button className="btn-icon" title="Help" aria-label="Help" onClick={() => navigate('/patient/help')}>
            <Icon name="help-circle" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- AppShell (sidebar + topbar + content) ----------
function AppShell({ current, children }) {
  const store = useStore();
  const route = useHashRoute();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const path = route.split('/').filter(Boolean)[0];
  // derive role directly from URL to keep sidebar in sync during navigation
  const role = path === 'admin' ? 'admin' : path === 'patient' ? 'patient' : path === 'doctor' ? 'doctor' : store.role;

  // Close the mobile drawer on navigation and when Escape is pressed
  useEffect(() => { setMobileNavOpen(false); }, [route]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  return (
    <div className="app">
      <Sidebar role={role} current={current} />
      {mobileNavOpen && (
        <div className="mobile-nav-scrim" onClick={() => setMobileNavOpen(false)}>
          <aside className="mobile-nav" onClick={e => e.stopPropagation()}>
            {/* React Bits AnimatedContent — portal drawer slides in from the left
                on open (the aside itself has no CSS entrance animation). The
                wrapper carries .mobile-nav-slide so CSS can stretch it to the
                drawer's full height — without it the wrapper's auto height makes
                the sidebar's height:100% collapse and the user footer sits
                right under the nav instead of at the drawer bottom. */}
            <AnimatedContent className="mobile-nav-slide" distance={300} direction="horizontal" reverse duration={0.4}>
              <Sidebar role={role} current={current} />
            </AnimatedContent>
          </aside>
        </div>
      )}
      <div className="main">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        {children}
      </div>
      <ToastLayer />
    </div>
  );
}

// ---------- Public shell ----------
function PublicNav({ activeLink = 'home' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const store = useStore();
  // Session-aware CTA: a signed-in visitor gets a link to their portal
  // instead of Log in/Register (the marketing pages stay browsable for all)
  const session = store.patientSession ? 'patient' : store.adminSession ? 'admin' : store.doctorSession ? 'doctor' : null;
  const sessionCta = session === 'patient' ? { label: 'Patient portal', cta: 'Open patient portal', href: '#/patient/dashboard' }
    : session === 'admin' ? { label: 'Admin console', cta: 'Open admin console', href: '#/admin/dashboard' }
    : session === 'doctor' ? { label: 'Doctor portal', cta: 'Open doctor portal', href: '#/doctor/dashboard' }
    : null;
  // Shadow + solid background once the page scrolls (nav is sticky on public pages)
  const [scrolled, setScrolled] = useState(false);
  const links = [
    { to: '#/landing', key: 'home', label: 'Home' },
    { to: '#/services', key: 'services', label: 'Services' },
    { to: '#/doctors', key: 'doctors', label: 'Doctors' },
    { to: '#/about', key: 'about', label: 'About' },
    { to: '#/contact', key: 'contact', label: 'Contact' },
  ];

  // Brand block → home (standard logo behavior). When already on the home page
  // the anchor would be a no-op (same URL, no hashchange), so we smooth-scroll
  // back to the top ourselves; otherwise the href navigates and useHashRoute
  // jumps to the top of the new page.
  const goHome = (e) => {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    const [path] = hash.split('?');
    if (path === '' || path === '/' || path === '/landing') {
      e.preventDefault();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock page scroll while the drawer is open; Escape closes it
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <Fragment>
      <div className={`public-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="#/landing" className="public-nav-brand" title="Back to home" aria-label="MedicaCare: back to home page" onClick={goHome}>
          <BrandMark size={34} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{window.HOSPITAL.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(window.HOSPITAL.address.split(',')[1] || '').trim()}, PH</div>
          </div>
        </a>
        <div className="public-nav-links">
          {links.map(l => (
            <a key={l.key} href={l.to} className={activeLink === l.key ? 'active' : ''}>{l.label}</a>
          ))}
        </div>
        <div className="public-nav-cta">
          {sessionCta ? (
            <a className="btn btn-primary" href={sessionCta.href}>{sessionCta.cta}</a>
          ) : (
            <>
              <a className="btn btn-ghost" href="#/login">Log in</a>
              <a className="btn btn-primary" href="#/register">Register</a>
            </>
          )}
        </div>
        <button className="public-nav-burger" title="Open menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Icon name="menu" size={20} />
        </button>
      </div>

      {menuOpen && (
        <Fragment>
          <div className="public-drawer-scrim" onClick={() => setMenuOpen(false)} />
          <div className="public-drawer">
            <div className="public-drawer-head">
              <a href="#/landing" className="public-nav-brand" title="Back to home" aria-label="MedicaCare: back to home page"
                onClick={(e) => { setMenuOpen(false); goHome(e); }}>
                <BrandMark size={34} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>{window.HOSPITAL.name}</div>
              </a>
              <button className="btn-icon" title="Close menu" aria-label="Close menu" onClick={() => setMenuOpen(false)}><Icon name="x" size={16} /></button>
            </div>
            <AnimatedContent className="public-drawer-slide" distance={24} duration={0.5} delay={0.12}>
            <nav className="public-drawer-links">
              {links.map(l => (
                <a key={l.key} href={l.to} className={activeLink === l.key ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                  {l.label}
                  <Icon name="chevron-right" size={15} />
                </a>
              ))}
            </nav>
            </AnimatedContent>
            <div className="public-drawer-cta">
              {sessionCta ? (
                <a className="btn btn-primary" href={sessionCta.href} onClick={() => setMenuOpen(false)}>{sessionCta.label}</a>
              ) : (
                <>
                  <a className="btn btn-secondary" href="#/login" onClick={() => setMenuOpen(false)}>Log in</a>
                  <a className="btn btn-primary" href="#/register" onClick={() => setMenuOpen(false)}>Register</a>
                </>
              )}
            </div>
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}

// Phase 3 — tumatanggap ng `clinic` prop (reactive, mula sa store); kapag
// wala, bumabagsak sa window.HOSPITAL (na naka-sync mula sa store).
function PublicFooter({ clinic }) {
  const c = clinic && clinic.name ? clinic : window.HOSPITAL;
  return (
    <footer className="public-footer">
      {/* Always-on urgent-care line (NHS pattern: red is reserved for urgent
          guidance). Complements the dismissible NoticeBar at the top. */}
      <div className="footer-emergency">
        <Icon name="siren" size={13} />
        <span><strong>Emergencies:</strong> go directly to the ER or call 911. Online booking is for scheduled visits only.</span>
      </div>
      <div>
        <div>© 2026 {c.name} · {c.address} · {c.phone}</div>
        <div style={{ marginTop: 4 }}>Clinic hours: Mon–Fri 8:00 AM – 5:00 PM · Sat 9:00 AM – 1:00 PM · Closed on Sundays</div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <a href="#/privacy">Privacy</a>
        <a href="#/terms">Terms</a>
        <a href="#/contact">Contact</a>
      </div>
      {/* Subject-project disclaimer — hospital and all data are fictional/dummy */}
      <div className="footer-disclaimer">
        <Icon name="info" size={12} />
        <span>
          This website is for a school subject project (IPT2) only: MedicaCare is a fictional
          hospital and all doctors, patients, and appointments are dummy data.
        </span>
      </div>
    </footer>
  );
}

// ============================================================
// Public-page interactive widgets (patterns researched from
// Cleveland Clinic / Mayo Clinic public sites)
// ============================================================

// ---------- Dismissible 24/7 emergency hotline bar ----------
function NoticeBar({ phone }) {
  // Dismissed for the current browser session only — returns on the next visit
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('nmc.noticeDismissed') === '1'; } catch { return false; }
  });
  // Mirror the dismissed state onto <html> so the Landing hero can subtract
  // the notice bar from its viewport-height math (see html.notice-dismissed
  // rules in styles.css) — otherwise dismissing the bar leaves a dead gap
  // under the trust ticker on the fold
  useEffect(() => {
    document.documentElement.classList.toggle('notice-dismissed', dismissed);
    return () => document.documentElement.classList.remove('notice-dismissed');
  }, [dismissed]);
  if (dismissed) return null;
  const dismiss = () => {
    try { sessionStorage.setItem('nmc.noticeDismissed', '1'); } catch { /* private mode */ }
    setDismissed(true);
  };
  return (
    <div className="public-notice-bar" role="status">
      <div className="public-notice-inner">
        <Icon name="siren" size={14} />
        <span><strong className="notice-strong">24/7 Emergency care:</strong> our ER never closes: walk in anytime or call us.</span>
        {phone && <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>}
        <button className="public-notice-close" aria-label="Dismiss announcement" title="Dismiss" onClick={dismiss}>
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------- Live "Open now / Closed" pill (computed from clinic hours) ----------
// Hours follow the footer schedule: Mon–Fri 8AM–5PM, Sat 9AM–1PM, Sun closed.
function ClinicStatus() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const mins = now.getHours() * 60 + now.getMinutes();
  const isOpen = day !== 0 && day !== 6
    ? mins >= 8 * 60 && mins < 17 * 60
    : day === 6 && mins >= 9 * 60 && mins < 13 * 60;
  const nextOpen = (day === 6 && mins >= 13 * 60) || day === 0
    ? 'Mon 8:00 AM'
    : mins < 8 * 60 ? 'today 8:00 AM' : 'tomorrow 8:00 AM';
  return (
    <span className={`clinic-status ${isOpen ? 'open' : 'closed'}`}>
      <span className="clinic-status-dot" />
      {isOpen
        ? <>Open now · closes {day === 6 ? '1:00 PM' : '5:00 PM'}</>
        : <>Clinic closed · opens {nextOpen}</>}
    </span>
  );
}

// ---------- FAQ accordion (expand/collapse Q&A list) ----------
function FaqAccordion({ items }) {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="faq-accordion">
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div className={`faq-item ${open ? 'open' : ''}`} key={item.q}>
            <button className="faq-question" aria-expanded={open} onClick={() => setOpenIdx(open ? -1 : i)}>
              <span>{item.q}</span>
              <Icon name="chevron-down" size={16} />
            </button>
            {open && <div className="faq-answer">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Auto-rotating testimonial carousel (pauses on hover/focus/toggle) ----------
function TestimonialCarousel({ items, interval = 6000 }) {
  const [idx, setIdx] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  // Explicit play/pause toggle — hover alone is not a pause mechanism for
  // keyboard or touch users (WCAG 2.2.2: moving content needs pause/stop)
  const [userPaused, setUserPaused] = useState(false);
  // Auto-advance is off entirely under prefers-reduced-motion: with the CSS
  // transition disabled, slides would jump instead of slide, which reads as
  // broken. Arrows and dots still work; there is nothing auto-moving to pause.
  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const count = items.length;
  const paused = hoverPaused || userPaused || reduceMotion;
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduceMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % count), interval);
    return () => clearInterval(t);
  }, [paused, count, interval]);
  const go = (i) => setIdx(((i % count) + count) % count);
  return (
    <div
      className="testimonial-carousel"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      // React onFocus/onBlur bubble — pause auto-advance while any control
      // (arrows, dots, toggle) inside has keyboard focus
      onFocus={() => setHoverPaused(true)}
      onBlur={() => setHoverPaused(false)}
    >
      <div className="testimonial-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {items.map((t, i) => (
          // aria-hidden keeps screen readers on the visible slide instead of
          // reading all quotes as one stream
          <div
            className="testimonial-slide"
            key={t.who}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== idx}
          >
            <div className="feature-card testimonial-card">
              <p className="testimonial-quote">"{t.quote}"</p>
              <div className="testimonial-who">{t.who}</div>
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="testimonial-controls">
          {!reduceMotion && (
            <button
              className="testimonial-arrow"
              aria-label={userPaused ? 'Play rotating testimonials' : 'Pause rotating testimonials'}
              aria-pressed={userPaused}
              onClick={() => setUserPaused(p => !p)}
            >
              <Icon name={userPaused ? 'play' : 'pause'} size={16} />
            </button>
          )}
          <button className="testimonial-arrow" aria-label="Previous testimonial" onClick={() => go(idx - 1)}>
            <Icon name="chevron-left" size={16} />
          </button>
          <div className="testimonial-dots">
            {items.map((t, i) => (
              <button
                key={t.who}
                className={`testimonial-dot ${i === idx ? 'on' : ''}`}
                aria-label={`Go to testimonial ${i + 1}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button className="testimonial-arrow" aria-label="Next testimonial" onClick={() => go(idx + 1)}>
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Page Header ----------
function PageHeader({ title, subtitle, breadcrumbs, actions }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumbs && (
          <div className="breadcrumbs">
            {breadcrumbs.map((b, i) => (
              <Fragment key={i}>
                {i > 0 && <Icon name="chevron-right" size={12} />}
                {b.to
                  // Real href (audit-002 #2): keyboard-focusable and
                  // right/middle-clickable; navigate() keeps the
                  // scroll-to-top behavior consistent
                  ? <a href={'#' + b.to} onClick={e => { e.preventDefault(); navigate(b.to); }}>{b.label}</a>
                  : <span>{b.label}</span>}
              </Fragment>
            ))}
          </div>
        )}
        <h1 className="h-page">{title}</h1>
        {subtitle && <p className="t-muted" style={{ marginTop: 4, marginBottom: 0, fontSize: 14 }}>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export { DesktopOnlyNotice, BrandMark, Sidebar, Topbar, AppShell, PublicNav, PublicFooter, NoticeBar, ClinicStatus, FaqAccordion, TestimonialCarousel, PageHeader };

