successfully downloaded text file (SHA: aa713892d8ac0e5d40575753f43f7d7cedf2af2a)
// AboutPage — public (split from screens-public.jsx)

import { ClinicStatus, Icon, PublicFooter, PublicNav, useStore } from '../shared/components.jsx';
import CountUp from '../shared/reactbits/CountUp.jsx';
import Magnet from '../shared/reactbits/Magnet.jsx';

import { HeroAurora, HeroTitle } from './hero.jsx';

// ---------- About page ----------
function AboutPage() {
  const store = useStore();
  // Every figure matches the app's own data or the fictional hospital's stated
  // lore (est. 1991); nothing invented beyond the disclosed fiction (R-17).
  // Phase 3 — ang directory ay galing na sa DB; kapag hindi pa naglo-load,
  // ang empty figures ay nagpapakita ng neutral dash sa halip na ₱NaN / 0 counts.
  const minFee = store.doctors.length ? Math.min(...store.doctors.map(d => d.fee)) : null;
  // Numeric stats animate in with React Bits CountUp; the non-numeric
  // '35 yrs' figure stays static. Same seed-data numbers as before (R-17).
  const stats = [
    store.doctors.length
      ? { to: store.doctors.length, label: 'Board-certified specialists' }
      : { value: '—', label: 'Board-certified specialists' },
    store.specialties.length
      ? { to: store.specialties.length, label: 'Departments & centers' }
      : { value: '—', label: 'Departments & centers' },
    { value: '35 yrs', label: 'Serving Quezon City (est. 1991)' },
    minFee != null
      ? { value: `₱${minFee.toLocaleString('en-PH')}`, label: 'Consultation fees start at' }
      : { value: '—', label: 'Consultation fees start at' },
  ];
  // Equal-weight by design: these values are peers, and the uniform treatment
  // IS the hierarchy decision (documented in DESIGN.md, RHYTHM note)
  const values = [
    { title: 'Patient safety first', desc: 'Evidence-based protocols, accredited facilities, and strict data privacy for every record.' },
    { title: 'Clinical excellence', desc: 'Board-certified doctors and continuous training across every department.' },
    { title: 'Compassionate care', desc: 'We treat people, not just charts: clear explanations and respect at every visit.' },
  ];
  return (
    <main>
      <PublicNav activeLink="about" />
      <section className="public-hero page-hero">
        <HeroAurora />
        <div className="public-hero-inner">
          <HeroTitle>About MedicaCare</HeroTitle>
          <p className="public-hero-sub">{store.clinic.tagline}</p>
        </div>
      </section>

      <section className="public-section" style={{ paddingTop: 8 }}>
        <div className="public-section-inner">
          <h2>Who we are</h2>
          <p className="public-section-sub">
            MedicaCare is a fictional private hospital along Rizal Avenue, Quezon City.
            Since 1991 we have combined modern facilities with a personal approach to care, from routine
            check-ups to specialty consultations, for families across Metro Manila.
          </p>
          <div className="grid-4">
            {stats.map(s => (
              // Value and label only — no icon chips; the number is the content
              <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  {s.value || <>{s.prefix || ''}<CountUp to={s.to} duration={1.6} /></>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" style={{ background: 'var(--bg)', paddingTop: 32 }}>
        <div className="public-section-inner">
          <h2>What we stand for</h2>
          <p className="public-section-sub">The principles behind every consultation, lab result, and follow-up call.</p>
          <div className="feature-grid">
            {values.map(v => (
              <div className="feature-card" key={v.title}>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" style={{ paddingTop: 32 }}>
        <div className="public-section-inner">
          <h2>Visit us</h2>
          <p className="public-section-sub">We're open daily, with 24/7 emergency care.</p>
          <div style={{ marginBottom: 16 }}>
            <ClinicStatus />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <Icon name="map-pin" size={16} /> {store.clinic.address}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <Icon name="phone" size={16} /> {store.clinic.phone}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <Icon name="mail" size={16} /> {store.clinic.email}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <Magnet padding={40} magnetStrength={3}>
              <a className="btn btn-primary" href="#/contact">Contact us</a>
            </Magnet>
            <a className="btn btn-secondary" href="#/doctors">Meet our doctors</a>
          </div>
        </div>
      </section>

      <PublicFooter clinic={store.clinic} />
    </main>
  );
}

export { AboutPage };

