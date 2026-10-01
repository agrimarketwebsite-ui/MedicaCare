// ServicesPage — public (split from screens-public.jsx)

import { FaqAccordion, Icon, navigate, PublicFooter, PublicNav, useStore } from '../shared/components.jsx';
import { SPECIALTIES } from '../shared/data.js';
import Magnet from '../shared/reactbits/Magnet.jsx';
import { SERVICES_FAQS } from './content.js';
import { HeroAurora, HeroTitle } from './hero.jsx';

// ---------- Services page ----------
function ServicesPage() {
  const store = useStore();
  const services = [
    { icon: 'stethoscope', title: 'General & specialty consultations', desc: 'Board-certified physicians across 10 specialties, from family medicine to neurology.' },
    { icon: 'calendar-check', title: 'Online appointment booking', desc: 'Pick a doctor, choose an open time slot, and get instant confirmation, no phone calls needed.' },
    { icon: 'activity', title: 'Laboratory & diagnostics', desc: 'Complete blood work, urinalysis, and other routine labs with same-day results for most tests.' },
    { icon: 'search', title: 'Imaging services', desc: 'X-ray, ultrasound, and ECG performed by licensed technologists and read by our radiologists.' },
    { icon: 'check-circle-2', title: 'Executive check-up packages', desc: 'Comprehensive annual physical exam bundles tailored to your age and risk profile.' },
    { icon: 'shield-check', title: 'HMO & insurance assistance', desc: 'We process claims with major HMO providers so you can focus on getting better.' },
  ];
  return (
    <main>
      <PublicNav activeLink="services" />
      <section className="public-hero page-hero">
        <HeroAurora />
        <div className="public-hero-inner">
          <HeroTitle>Our services</HeroTitle>
          <p className="public-hero-sub">Everything you need for outpatient care, all in one medical center.</p>
        </div>
      </section>

      <section className="public-section" style={{ paddingTop: 8 }}>
        <div className="public-section-inner">
          {/* First card spans two columns: consultations are the primary
              offering; the rest are supporting services (R-14 hierarchy
              reason, written down). Plain card — no cursor-glow spotlight:
              the hover border/lift is the whole interaction (DESIGN.md
              MOTION 1, ui-guidelines §3). */}
          <div className="feature-grid">
            {services.map((s, i) => (
              <div
                className={`feature-card${i === 0 ? ' feature-card--featured' : ''}`}
                key={s.title}
              >
                <div className="feature-card-icon"><Icon name={s.icon} size={18} /></div>
                <h2 className="feature-card-title">{s.title}</h2>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" style={{ background: 'var(--bg)', paddingTop: 32 }}>
        <div className="public-section-inner">
          <span className="section-kicker">Find your department</span>
          <h2>Departments & specialties</h2>
          <p className="public-section-sub">Tap a department to see its specialists.</p>
          {SPECIALTIES.length > 0 ? (
            <div className="grid-4">
              {SPECIALTIES.map(s => (
                <button key={s} className="dept-chip" onClick={() => navigate(`/doctors?spec=${encodeURIComponent(s)}`)}>
                  {s}
                  <Icon name="arrow-right" size={14} className="dept-arrow" />
                </button>
              ))}
            </div>
          ) : (
            <p className="t-muted" style={{ fontSize: 14 }}>
              Our department directory is being connected to the hospital database — check back shortly.
            </p>
          )}
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-inner public-section--centered">
          <span className="section-kicker">Good to know</span>
          <h2>Service FAQs</h2>
          <p className="public-section-sub">Answers to what patients ask us most about our services.</p>
          <FaqAccordion items={SERVICES_FAQS} />
        </div>
      </section>

      <section className="public-section" style={{ paddingTop: 32, textAlign: 'center' }}>
        <div className="public-section-inner">
          <h2>Skip the phone queue: book online</h2>
          <p className="public-section-sub">
            {store.patientSession
              ? 'You already have an account — book your next visit from the patient portal.'
              : 'Create a free patient account and see a specialist as early as tomorrow.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {store.patientSession ? (
              <a className="btn btn-primary" href="#/patient/doctors">Open patient portal</a>
            ) : (
              <>
                <Magnet padding={40} magnetStrength={3}>
                  <a className="btn btn-primary" href="#/register">Create patient account</a>
                </Magnet>
                <a className="btn btn-secondary" href="#/doctors">Browse doctors</a>
              </>
            )}
          </div>
        </div>
      </section>

      <PublicFooter clinic={store.clinic} />
    </main>
  );
}

export { ServicesPage };

