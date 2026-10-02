// DoctorListing — patient (split from screens-patient.jsx)
import { useEffect, useState } from 'react';
import { AppShell, DoctorAvatar, DoctorRatingPill, DoctorStatusBadge, EmptyState, Icon, Modal, navigate, PageHeader, Pagination, SelectInput, useStore } from '../shared/components.jsx';
import { SPECIALTIES } from '../shared/data.js';
import { CARE_GUIDE } from '../public/content.js';
import { activateOnKey } from './helpers.js';

// ---------- Doctor Listing ----------
const MOBILE_DOCTOR_QUERY = '(max-width: 720px)';

const MOBILE_DOCTOR_PAGE_SIZE = 6;

function DoctorListing() {
  const store = useStore();
  // Simulated fetch — skeleton cards while "loading", same 600ms pattern as
  // the other patient pages
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [avail, setAvail] = useState('all');
  const [page, setPage] = useState(1);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_DOCTOR_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_DOCTOR_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Back to page 1 whenever the filters or the layout mode change so the
  // selected page is never out of range for the current page size
  useEffect(() => { setPage(1); }, [query, specialty, avail, isMobile]);

  const filtered = store.doctors.filter(d => {
    if (query && !(d.name.toLowerCase().includes(query.toLowerCase()) || d.specialty.toLowerCase().includes(query.toLowerCase()))) return false;
    if (specialty !== 'all' && d.specialty !== specialty) return false;
    if (avail !== 'all' && d.status !== avail) return false;
    return true;
  });

  const visibleDoctors = isMobile
    ? filtered.slice((page - 1) * MOBILE_DOCTOR_PAGE_SIZE, page * MOBILE_DOCTOR_PAGE_SIZE)
    : filtered;

  const [profileDoc, setProfileDoc] = useState(null);

  return (
    <AppShell current="doctors">
      <div className="page">
        <PageHeader
          title="Find a doctor"
          subtitle="Browse specialists by department and check real-time availability."
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Find a doctor' }]}
        />

        {/* Filter bar */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="doctor-filters">
            <div className="input-group doctor-filter-search">
              <Icon name="search" size={16} className="input-icon" />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search by name or specialty…" aria-label="Search doctors by name or specialty" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className="doctor-filter-field">
              <SelectInput value={specialty} onChange={e => setSpecialty(e.target.value)}>
                <option value="all">All specialties</option>
                {window.SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
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
            {/* Symptom quick filter — the same symptom → specialty guide as the
                Landing "Not sure where to go for care?" section (shared
                CARE_GUIDE). Picking a symptom just sets the specialty filter,
                so it stays in sync with the dropdown above (single state). */}
            <div className="doctor-filter-field">
              <SelectInput
                aria-label="Filter by symptom"
                value={CARE_GUIDE.find(g => g.specialty === specialty)?.symptom || ''}
                onChange={e => {
                  const guide = CARE_GUIDE.find(g => g.symptom === e.target.value);
                  setSpecialty(guide ? guide.specialty : 'all');
                }}
              >
                <option value="">Any symptom</option>
                {CARE_GUIDE.map(g => <option key={g.symptom} value={g.symptom}>{g.symptom}</option>)}
              </SelectInput>
            </div>
            <div className="doctor-filter-count">
              <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> of {store.doctors.length} doctors
            </div>
          </div>
        </div>

        {loading ? (
          // Skeleton doctor cards mirroring the real card layout (avatar +
          // name + specialty + rating/badge + room) so there is no layout shift
          <div className="doctor-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="doctor-card">
                <div className="doctor-card-head">
                  <span className="skel" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="skel" style={{ width: '80%', height: 14, display: 'block' }} />
                    <span className="skel" style={{ width: '50%', height: 11, display: 'block', marginTop: 7 }} />
                  </div>
                </div>
                <div className="doctor-card-meta">
                  <span className="skel" style={{ width: 90, height: 12 }} />
                  <span className="skel" style={{ width: 70, height: 18 }} />
                </div>
                <div className="doctor-card-meta">
                  <span className="skel" style={{ width: '75%', height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="search-x"
              title={`No doctors match "${query || specialty}"`}
              message="Try broadening your search or clearing filters to see more results."
              actions={<button className="btn btn-secondary" onClick={() => { setQuery(''); setSpecialty('all'); setAvail('all'); }}>Clear filters</button>}
            />
          </div>
        ) : (
          <>
            <div className="doctor-grid">
              {visibleDoctors.map((d, i) => (
              // Plain wrapper — no entrance or spotlight-glow animation. The
              // interactive card keeps role="button" instead of a real <button>
              // because the card contains its own nested buttons (View profile /
              // Book); keyboard users get Enter/Space activation via
              // activateOnKey (guidelines 20 & 36)
              <div className="doctor-card-wrap" key={d.id}>
              <div
                className="doctor-card"
                role="button"
                tabIndex={0}
                aria-label={`View availability and book with ${d.name}`}
                onClick={() => navigate('/patient/availability/' + d.id)}
                onKeyDown={activateOnKey(() => navigate('/patient/availability/' + d.id))}
              >
                <div className="doctor-card-head">
                  <DoctorAvatar doctor={d} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="doctor-card-name">{d.name}</div>
                    <div className="doctor-card-spec">{d.specialty}</div>
                  </div>
                </div>
                <div className="doctor-card-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DoctorRatingPill avg={d.rating} count={d.ratingCount} />
                    <span>· {d.exp} yrs</span>
                  </div>
                  <DoctorStatusBadge status={d.status} />
                </div>
                <div className="doctor-card-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="map-pin" size={13} /> {d.room}
                  </div>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>₱{d.fee.toLocaleString()}</div>
                </div>
                <div className="doctor-card-footer">
                  <button className="btn btn-ghost sm" onClick={(e) => { e.stopPropagation(); setProfileDoc(d); }}>View profile</button>
                  <button className="btn btn-primary sm"
                    disabled={d.status === 'on-leave'}
                    onClick={(e) => { e.stopPropagation(); navigate('/patient/availability/' + d.id); }}>
                    Book
                  </button>
                </div>
              </div>
              </div>
            ))}
            </div>

            {/* Honesty labels: portraits are placeholders; ratings are real
                patient feedback averages (v_doctor_rating_averages) */}
            <p className="t-muted" style={{ fontSize: 12.5, marginTop: 14 }}>
              Doctor photos are sample placeholder portraits (randomuser.me), not real staff photos. Ratings are averages of real patient feedback from completed visits.
            </p>

            {isMobile && (
              <div className="doctors-pager" style={{ marginTop: 16 }}>
                <Pagination page={page} setPage={setPage} total={filtered.length} pageSize={MOBILE_DOCTOR_PAGE_SIZE} label="doctors" />
              </div>
            )}
          </>
        )}

        {profileDoc && (
          <Modal
            open
            onClose={() => setProfileDoc(null)}
            title="Doctor profile"
            icon="stethoscope"
            iconKind="info"
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => setProfileDoc(null)}>Close</button>
                <button
                  className="btn btn-primary"
                  disabled={profileDoc.status === 'on-leave'}
                  onClick={() => navigate('/patient/availability/' + profileDoc.id)}
                >
                  Book appointment
                </button>
              </>
            }
          >
            <div className="appt-head">
              <DoctorAvatar doctor={profileDoc} size={56} />
              <div className="appt-head-info">
                <div style={{ fontWeight: 600, fontSize: 16 }}>{profileDoc.name}</div>
                <div className="t-muted">{profileDoc.specialty}</div>
              </div>
              <div className="appt-head-status">
                <DoctorStatusBadge status={profileDoc.status} />
              </div>
            </div>
            <div className="divider" />
            <div className="detail-list">
              <div className="detail-row"><div className="label">Consultation fee</div><div className="value">₱{profileDoc.fee.toLocaleString()}</div></div>
              <div className="detail-row"><div className="label">Experience</div><div className="value">{profileDoc.exp} years</div></div>
              <div className="detail-row"><div className="label">Rating</div><div className="value"><DoctorRatingPill avg={profileDoc.rating} count={profileDoc.ratingCount} /></div></div>
              <div className="detail-row"><div className="label">Room</div><div className="value">{profileDoc.room}</div></div>
              <div className="detail-row"><div className="label">Consultation length</div><div className="value">30 minutes</div></div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}

export { MOBILE_DOCTOR_QUERY, MOBILE_DOCTOR_PAGE_SIZE, DoctorListing };

