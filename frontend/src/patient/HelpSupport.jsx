// HelpSupport — patient (split from screens-patient.jsx)
import { useEffect, useState } from 'react';
import { AppShell, Badge, Field, Icon, navigate, PageHeader, PageSpinner, TextArea, TextInput, useStore } from '../shared/components.jsx';
import { focusFirstError } from './helpers.js';

import { Profile } from './Profile.jsx';

// ---------- Help & Support (patient portal only) ----------
function HelpSupport() {
  const store = useStore();
  const me = store.currentPatient || window.CURRENT_PATIENT;
  // Simulated fetch — centered circle spinner while "loading", same 600ms
  // pattern as the patient Book/Profile pages (PageSpinner centers it on
  // both axes)
  const [pageLoading, setPageLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPageLoading(false), 600); return () => clearTimeout(t); }, []);
  const [open, setOpen] = useState(0);

  // "Share your experience" — submissions go to the admin console as pending
  // and only appear on the public website after staff approval, under a
  // display name (never the account identity)
  const meName = me.name || me.full_name || '';
  const displayNameDefault = (() => {
    const parts = meName.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : (parts[0] || 'Patient');
  })();
  const [storyForm, setStoryForm] = useState({ displayName: displayNameDefault, quote: '' });
  const [storyErrors, setStoryErrors] = useState({});
  const meId = me.id || me.patient_id;
  const myStories = (store.testimonials || []).filter(t => String(t.patientId) === String(meId));
  const updateStory = (k, v) => { setStoryForm(f => ({ ...f, [k]: v })); if (storyErrors[k]) setStoryErrors(e => ({ ...e, [k]: null })); };

  const submitStory = (e) => {
    e.preventDefault();
    const errs = {};
    if (!storyForm.displayName.trim()) errs.displayName = 'Please enter a display name';
    const q = storyForm.quote.trim();
    if (!q) errs.quote = 'Please share your experience';
    else if (q.length < 30) errs.quote = 'Please write a bit more (30+ characters)';
    setStoryErrors(errs);
    if (Object.keys(errs).length) { focusFirstError(); return; }
    store.setTestimonials([
      {
        id: 't' + Date.now(),
        patientId: meId,
        displayName: storyForm.displayName.trim(),
        quote: q,
        status: 'pending',
        createdAt: new Date().toISOString().slice(0, 10),
      },
      ...(store.testimonials || []),
    ]);
    setStoryForm({ displayName: displayNameDefault, quote: '' });
    store.pushToast({ title: 'Story submitted', msg: 'Thank you! Our staff will review it before it appears on the website.' });
  };

  const faqs = [
    { q: 'How do I book an appointment?', a: 'Go to "Find a doctor", pick a doctor, choose an available date and time slot, then fill out the booking form. You will receive a confirmation with a reference number once submitted.' },
    { q: 'Can I cancel or reschedule an appointment?', a: 'Yes. Open the appointment from "My appointments" or its details page — use Reschedule to pick a new date and time slot, or Cancel to release the slot. Both are free any time before your visit.' },
    { q: 'What do the appointment statuses mean?', a: 'Pending means your request was received and is awaiting confirmation. Confirmed means your slot is reserved. Completed means the visit has happened. Cancelled means the appointment was called off.' },
    { q: 'How do I update my personal information?', a: 'Go to your Profile page to edit your contact details, address, emergency contact, and change your password.' },
    { q: 'Are my records and data secure?', a: 'Yes. Your account is protected by your password, and sensitive details (like contact information) are stored encrypted on the clinic\u2019s servers. Only you and authorized clinic staff can see your records.' },
  ];

  if (pageLoading) {
    return (
      <AppShell current="help">
        <div className="page"><PageSpinner /></div>
      </AppShell>
    );
  }

  return (
    <AppShell current="help">
      <div className="page" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PageHeader
          title="Help & support"
          subtitle="Find quick answers or get in touch with our team."
          breadcrumbs={[{ label: 'Home', to: '/patient/dashboard' }, { label: 'Help & support' }]}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            {/* bare glyph, no tinted square — matches the public Contact page
                info rows; the chip style is reserved for interactive buttons */}
            <div className="card"><div className="card-body">
              <div className="feature-card-icon" style={{ marginBottom: 10 }}><Icon name="phone" size={18} /></div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Call us</div>
            <div className="t-muted" style={{ fontSize: 13 }}>{window.HOSPITAL.phone}</div>
            <div className="t-muted" style={{ fontSize: 12 }}>Mon–Sat, 8:00 AM – 6:00 PM</div>
          </div></div>
          <div className="card"><div className="card-body">
            <div className="feature-card-icon" style={{ marginBottom: 10 }}><Icon name="mail" size={18} /></div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Email us</div>
            <div className="t-muted" style={{ fontSize: 13 }}>{window.HOSPITAL.email}</div>
            <div className="t-muted" style={{ fontSize: 12 }}>We reply within 1–2 business days</div>
          </div></div>
          <div className="card"><div className="card-body">
            <div className="feature-card-icon" style={{ marginBottom: 10 }}><Icon name="map-pin" size={18} /></div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Visit us</div>
            <div className="t-muted" style={{ fontSize: 13 }}>{window.HOSPITAL.address}</div>
            <div className="t-muted" style={{ fontSize: 12 }}>Information desk, ground floor</div>
          </div></div>
          {/* Message the clinic moved to its own page (My messages) — this card
              keeps the entry point discoverable from Help & support */}
          <div className="card" role="button" tabIndex={0} aria-label="Message the clinic"
            onClick={() => navigate('/patient/messages')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/patient/messages'); } }}
            style={{ cursor: 'pointer' }}>
            <div className="card-body">
              <div className="feature-card-icon" style={{ marginBottom: 10 }}><Icon name="inbox" size={18} /></div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Message the clinic</div>
              <div className="t-muted" style={{ fontSize: 13 }}>Schedules, billing, HMO — staff reply in your portal</div>
              <div className="t-muted" style={{ fontSize: 12 }}>Opens your My messages page</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Share your experience</h2></div>
          <form onSubmit={submitStory} noValidate>
            <div className="card-body stack md">
              <p className="t-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                Booked with us before? Share what it was like. Stories are reviewed by our staff before
                appearing on the public website and are published under your display name only.
                Please don't include medical details or other people's information.
              </p>
              <Field label="Display name" required error={storyErrors.displayName} help="Shown with your story on the public website.">
                <TextInput value={storyForm.displayName} onChange={e => updateStory('displayName', e.target.value)} error={storyErrors.displayName} maxLength={40} />
              </Field>
              <Field label="Your story" required error={storyErrors.quote} help={`${storyForm.quote.trim().length}/280 characters. Minimum 30.`}>
                <TextArea
                  rows={3}
                  placeholder="e.g., Booking my follow-up took two taps and I had a confirmation before lunch."
                  value={storyForm.quote}
                  onChange={e => updateStory('quote', e.target.value)}
                  error={storyErrors.quote}
                  maxLength={280}
                />
              </Field>
              <div>
                <button type="submit" className="btn btn-primary">Submit for review</button>
              </div>
              {myStories.length > 0 && (
                <div className="stack md" style={{ paddingTop: 4 }}>
                  {myStories.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                      <Badge kind={s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'neutral'} dot={false}>
                        {s.status === 'approved' ? 'Shown on website' : s.status === 'pending' ? 'Pending review' : 'Not published'}
                      </Badge>
                      <span className="t-muted" style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>"{s.quote}"</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h2 className="h-section">Frequently asked questions</h2></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faqs.map((f, i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <button
                  type="button"
                  className="help-faq-q"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? -1 : i)}
                  style={{ background: 'transparent', border: 0, padding: '10px 0', minHeight: 44, width: '100%', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left' }}
                >
                  <Icon name={open === i ? 'chevron-down' : 'chevron-right'} size={16} />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{f.q}</span>
                </button>
                {open === i && (
                  <p className="t-muted" style={{ fontSize: 13.5, margin: '8px 0 0 24px', lineHeight: 1.55 }}>{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div className="empty-state-icon" style={{ background: 'var(--error-soft)', color: 'var(--error)' }}>
              <Icon name="alert-triangle" size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600 }}>Medical emergency?</div>
              <div className="t-muted" style={{ fontSize: 13 }}>Do not use this portal. Call 911 or go to the nearest emergency room immediately.</div>
            </div>
            <a className="btn btn-secondary" href="#/contact">Contact page</a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export { HelpSupport };
