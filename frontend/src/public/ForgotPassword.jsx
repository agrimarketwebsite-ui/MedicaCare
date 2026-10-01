// ForgotPassword — public (split from screens-public.jsx)
import { useState } from 'react';
import { BrandMark, Field, Icon, navigate, TextInput } from '../shared/components.jsx';
import { api } from '../shared/api.js';

import Aurora from '../shared/reactbits/Aurora.jsx';
import SplitText from '../shared/reactbits/SplitText.jsx';
import AnimatedContent from '../shared/reactbits/AnimatedContent.jsx';

// ---------- Forgot password ----------
// Phase 2 — POST /api/auth/forgot-password. Ang backend ay laging generic
// ang response (ASVS V2.5) — ang UI ay nagpapakita ng "sent" state anuman
// ang resulta, maliban sa validation/network errors. Ang email send ay
// ia-attach sa Phase 8 (Brevo).
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (evt) => {
    evt.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    setError(null);
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
        auth: false,
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" reverse duration={0.7}>
      <div className="auth-form-col">
        <div className="auth-form-inner">
          <div>
            <button className="btn btn-ghost" onClick={() => navigate('/login')} style={{ marginLeft: -10, marginBottom: 16 }}>
              <Icon name="arrow-left" size={16} /> Back to log in
            </button>
          </div>
          <div className="brand">
            <BrandMark size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>MedicaCare</div>
              <div className="t-muted" style={{ fontSize: 12 }}>Patient portal</div>
            </div>
          </div>
          <SplitText tag="h1" text="Forgot password" splitType="chars" delay={30} duration={0.9} textAlign="left" rootMargin="0px" />
          <AnimatedContent distance={20} duration={0.5} delay={0.55}>
            <p className="sub">Enter the email linked to your account and we'll send you a reset link.</p>
          </AnimatedContent>

          {sent ? (
            <div>
              <div role="status" style={{ background: 'var(--success-soft)', border: '1px solid var(--success-border)', color: 'var(--success-text)', padding: '12px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
                <Icon name="check-circle-2" size={16} style={{ marginTop: 1 }} />
                <div>
                  If an account exists for <strong>{email}</strong>, a password reset link is on its way.
                  Please check your inbox (and spam folder).
                </div>
              </div>
              <div className="footer-link">
                Didn't get it? <a href="#/forgot-password">Resend</a> or <a href="#/login">Back to log in</a>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack" noValidate>
              <Field label="Email address" required error={error}>
                <TextInput type="email" placeholder="you@example.com" value={email}
                  onChange={e => { setEmail(e.target.value); if (error) setError(null); }} error={error} icon="mail" />
              </Field>

              <button type="submit" className={`btn btn-primary lg ${loading ? 'btn-loading' : ''}`}>
                Send reset link
              </button>

              <div className="footer-link">
                Remembered it? <a href="#/login">Log in</a>
              </div>
            </form>
          )}
        </div>
      </div>
      </AnimatedContent>

      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" duration={0.7}>
      <div className="auth-visual-col auth-visual-col--forgot">
        <div className="auth-aurora" aria-hidden="true"><Aurora colorStops={['#60A5FA', '#E0F2FE', '#3B82F6']} amplitude={1.1} speed={0.6} blend={0.7} /></div>
        <BrandMark className="brand-mark" />
        <div>
          <div className="quote">"Your health records, appointments, and prescriptions: all in one secure place."</div>
          <div className="attrib">MedicaCare</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          © 2026 MedicaCare
        </div>
      </div>
      </AnimatedContent>
    </main>
  );
}

export { ForgotPassword };

