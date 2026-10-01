// DoctorsPage — public (split from screens-public.jsx)
import { useEffect, useMemo, useState } from 'react';
import { DoctorAvatar, DoctorRatingPill, DoctorStatusBadge, EmptyState, Icon, Modal, Pagination, PublicFooter, PublicNav, SelectInput, useStore } from '../shared/components.jsx';
import Magnet from '../shared/reactbits/Magnet.jsx';
import { HeroAurora, HeroTitle } from './hero.jsx';

// ---------- Doctors page ----------
const MOBILE_DOCTORS_QUERY = '(max-width: 720px)';

const MOBILE_DOCTORS_PAGE_SIZE = 6;

function DoctorsPage({ initialSpecialty = '' }) {
  const store = useStore();
  // Skeleton cards habang naglo-load ang directory mula sa API (Phase 3);
  // 2.5s fallback para hindi ma-stuck kapag offline ang backend
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (store.doctors.length > 0) { setLoading(false); return; }
    const t = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(t);
  }, [store.doctors]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  // Pre-filtered when navigated here with a specialty (e.g. #/doctors?spec=Cardiology
  // from the Landing care finder or department chips); defaults to "all".
  const [specialty, setSpecialty] = useState(
    store.specialties.includes(initialSpecialty) ? initialSpecialty : 'all'
  );
  const [avail, setAvail] = useState('all');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_DOCTORS_QUERY).matches);
  // Selected doctor for the profile preview modal (ZocDoc-style quick view)
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_DOCTORS_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Reset to the first page whenever the layout mode or filters change so the
  // selected page is never out of range for the current result set.
  useEffect(() => { setPage(1); }, [isMobile, query, specialty, avail]);

  // Follow the specialty deep link when it changes while the page is already
  // mounted (e.g. /doctors?spec=Cardiology → plain /doctors clears the filter).
  // Manual dropdown changes don't re-trigger this because the prop stays put.
  useEffect(() => {
    setSpecialty(store.specialties.includes(initialSpecialty) ? initialSpecialty : 'all');
  }, [initialSpecialty]);

  const filtered = useMemo(() => (
    store.doctors.filter(d => {
      if (query) {
        const hay = (d.name + ' ' + d.specialty).toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      if (specialty !== 'all' && d.specialty !== specialty) return false;
      if (avail !== 'all' && d.status !== avail) return false;
      return true;
    })
  ), [query, specialty, avail, store.doctors]);

  const visibleDoctors = isMobile
    ? filtered.slice((page - 1) * MOBILE_DOCTORS_PAGE_SIZE, page * MOBILE_DOCTORS_PAGE_SIZE)
    : filtered;

  const clearFilters = () => { setQuery(''); setSpecialty('all'); setAvail('all'); };

  return (
    <main>
      <PublicNav activeLink="doctors" />
      <section className="public-hero page-hero">
        <HeroAurora />
        <div className="public-hero-inner">
          <HeroTitle>Find a doctor</HeroTitle>
          <p className="public-hero-sub">
            {store.doctors.length} specialists on staff. Availability is updated in real time once you're logged in.
          </p>
        </div>
      </section>

      <section className="public-section" style={{ paddingTop: 8 }}>
        <div className="public-section-inner">
          {/* Filter bar — mirrors the patient-side doctor listing filters */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="doctor-filters">
              <div className="input-group doctor-filter-search">
                <Icon name="search" size={16} className="input-icon" />
                <input className="input" style={{ paddingLeft: 38 }} placeholder="Search by name or specialty…" aria-label="Search doctors by name or specialty" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div className="doctor-filter-field">
                <SelectInput value={specialty} onChange={e => setSpecialty(e.target.value)}>
                  <option value="all">All specialties</option>
                  {store.specialties.map(s => <option key={s} value={s}>{s}</option>)}
                </SelectInput>
              </div>
              <div className="doctor-filter-field sm">
                <SelectInput value={avail} onChange={e => setAvail(e.target.value)}>
                  <option value="all">Any availability</option>
                  <option value="available">Available today</option>
                  <option value="busy">Busy today</option>
                  <option value="on-leave">On leave</option>
                </SelectInput>
              </div>
              <div className="doctor-filter-count">
                <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> of {store.doctors.length} doctors
              </div>
            </div>
          </div>

          {loading ? (
            // Skeleton doctor cards mirroring the public card layout (32px
            // avatar + name/specialty, rating + status badge, room, then the
            // fee + "View profile" footer) so there is no layout shift when
            // the data lands
            <div className="doctor-grid" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="doctor-card">
                  <div className="doctor-card-head">
                    <span className="skel" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="skel" style={{ width: '75%', height: 13, display: 'block' }} />
                      <span className="skel" style={{ width: '55%', height: 11, display: 'block', marginTop: 6 }} />
                    </div>
                  </div>
                  <div className="doctor-card-meta">
                    <span className="skel" style={{ width: 52, height: 12 }} />
                    <span className="skel" style={{ width: 70, height: 18 }} />
                  </div>
                  <div className="doctor-card-meta">
                    <span className="skel" style={{ width: '70%', height: 12 }} />
                  </div>
                  <div className="doctor-card-footer">
                    <span className="skel" style={{ width: 78, height: 12 }} />
                    <span className="skel" style={{ width: 78, height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="search-x"
                title={query ? `No doctors match "${query}"` : 'No doctors match your filters'}
                message="Try broadening your search or clearing filters to see more results."
                actions={<button className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>}
              />
            </div>
          ) : (
            <div className="doctor-grid">
              {/* Plain wrapper — no entrance animation, same call as the patient
                  portal's doctor grid (DESIGN.md MOTION 1: no scroll-reveal;
                  the frontend-design skill audit removed the staggered card
                  entrances). SpotlightCard is not used here either: its dark
                  demo skin (.card-spotlight) loads after styles.css, so its
                  equal-specificity #111 background wins the cascade and paints
                  the wrapper black. .card-anim stays for the grid's
                  height:100% stretch. */}
              {visibleDoctors.map(d => (
                <div className="card-anim" key={d.id}>
                <div className="doctor-card-wrap">
                  <div
                    className="doctor-card"
                    role="button"
                    tabIndex={0}
                    aria-label={`View profile of ${d.name}`}
                    onClick={() => setSelectedDoctor(d)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDoctor(d); } }}
                  >
                  <div className="doctor-card-head">
                    <DoctorAvatar doctor={d} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="doctor-card-name">{d.name}</div>
                      <div className="doctor-card-spec">{d.specialty} · {d.exp} yrs experience</div>
                    </div>
                  </div>
                  <div className="doctor-card-meta">
                    <DoctorRatingPill ratings={store.ratings} doctorId={d.id} avg={d.rating} count={d.ratingCount} />
                    <DoctorStatusBadge status={d.status} />
                  </div>
                  <div className="doctor-card-meta">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="map-pin" size={13} /> {d.room}
                    </span>
                  </div>
                  <div className="doctor-card-footer">
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>₱{d.fee.toLocaleString()} / consult</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--primary)', fontWeight: 500 }}>
                      View profile
                    </span>
                  </div>
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}

          {isMobile && filtered.length > 0 && (
            <div className="doctors-pager" style={{ marginTop: 24 }}>
              <Pagination page={page} setPage={setPage} total={filtered.length} pageSize={MOBILE_DOCTORS_PAGE_SIZE} label="doctors" />
            </div>
          )}

          {/* R-23 honesty label: portraits are stock placeholders, not real staff */}
          <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={13} /> Doctor photos are placeholder portraits (randomuser.me), not real staff. Ratings shown are prototype demo data; ratings you submit from completed visits are added to them.
          </div>

          <div style={{ marginTop: 32, padding: 24, background: 'var(--primary-soft)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: '1 1 240px' }}>
              <div style={{ fontWeight: 600 }}>Ready to book an appointment?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {store.patientSession
                  ? "You're signed in — pick a doctor and reserve a slot from your patient portal."
                  : 'Log in or create an account to view real-time availability and reserve a slot.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              {store.patientSession ? (
                <a className="btn btn-primary" href="#/patient/doctors">Open patient portal</a>
              ) : (
                <>
                  <Magnet padding={40} magnetStrength={3}>
                    <a className="btn btn-primary" href="#/register">Register</a>
                  </Magnet>
                  <a className="btn btn-secondary" href="#/login">Log in</a>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Doctor profile quick-view (ZocDoc-style) — opens when a card is clicked */}
      <Modal
        open={!!selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
        title={selectedDoctor ? selectedDoctor.name : ''}
        subtitle={selectedDoctor ? `${selectedDoctor.specialty} · ${selectedDoctor.exp} years of experience` : ''}
        icon="stethoscope"
        iconKind="info"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSelectedDoctor(null)}>Close</button>
            {store.patientSession ? (
              <a className="btn btn-primary" href={'#/patient/availability/' + selectedDoctor.id} onClick={() => setSelectedDoctor(null)}>
                Book with this doctor
              </a>
            ) : (
              <a className="btn btn-primary" href="#/register" onClick={() => setSelectedDoctor(null)}>
                Book with this doctor
              </a>
            )}
          </>
        }
      >
        {selectedDoctor && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <DoctorAvatar doctor={selectedDoctor} size={56} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <DoctorStatusBadge status={selectedDoctor.status} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13 }}>
                    <DoctorRatingPill ratings={store.ratings} doctorId={selectedDoctor.id} />
                  </span>
                </div>
              </div>
            </div>
            <div className="detail-row compact">
              <div className="label">Clinic room</div>
              <div className="value">{selectedDoctor.room}</div>
            </div>
            <div className="detail-row compact">
              <div className="label">Consultation fee</div>
              <div className="value" style={{ fontWeight: 600 }}>₱{selectedDoctor.fee.toLocaleString()} / consult</div>
            </div>
            <div className="detail-row compact">
              <div className="label">Department</div>
              <div className="value">{selectedDoctor.specialty}</div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
              <Icon name="info" size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Portrait shown is a placeholder for this prototype. Create a free account to see real-time availability and reserve a slot.
            </div>
          </div>
        )}
      </Modal>

      <PublicFooter clinic={store.clinic} />
    </main>
  );
}

export { MOBILE_DOCTORS_QUERY, MOBILE_DOCTORS_PAGE_SIZE, DoctorsPage };

