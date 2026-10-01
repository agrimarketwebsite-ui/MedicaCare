// Login — public (split from screens-public.jsx)
import { useState } from 'react';
import { BrandMark, Field, Icon, navigate, PwField, TextInput, useStore } from '../shared/components.jsx';
import { api, setAccessToken } from '../shared/api.js';
import Aurora from '../shared/reactbits/Aurora.jsx';
import SplitText from '../shared/reactbits/SplitText.jsx';
import AnimatedContent from '../shared/reactbits/AnimatedContent.jsx';

import { AdminLogin } from './AdminLogin.jsx';

// ---------- Login ----------
function Login() {
  const store = useStore();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Phase 2 — ang profile ay galing sa API response (POST /api/auth/login).
  // Ang access token ay nasa memory lang (api.js); walang OTP step (ang email
  // OTP ay prototype demo lang — walang email service hanggang Phase 8).
  const finishLogin = (profile) => {
    store.loginPatient({
      id: profile.id, name: profile.full_name, email: profile.email, phone: profile.phone || '',
      dob: '', gender: '', address: '', emergencyContact: '', bloodType: '—', allergies: 'None',
      photo: profile.photo_url || '',
    });
    store.setRole('patient');
    navigate('/patient/dashboard');
  };

  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); setAuthError(null); };

  const submit = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setAuthError(null);
    try {
      // Ang backend ay laging generic ang error (ASVS V2.5) — hindi nito
      // sinasabi kung ang email o ang password ang mali.
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: form.email.trim(), password: form.password },
        auth: false,
      });
      setAccessToken(data.accessToken);
      finishLogin(data.profile);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" reverse duration={0.7}>
      <div className="auth-visual-col auth-visual-col--login" style={{ order: 0 }}>
        <div className="auth-aurora" aria-hidden="true"><Aurora colorStops={['#60A5FA', '#E0F2FE', '#3B82F6']} amplitude={1.1} speed={0.6} blend={0.7} /></div>
        <BrandMark className="brand-mark" />
        <div>
          <div className="quote">"Care that fits your schedule. See a specialist without the runaround."</div>
          <div className="attrib">MedicaCare</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          © 2026 MedicaCare
        </div>
      </div>
      </AnimatedContent>
      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" duration={0.7}>
      <div className="auth-form-col">
        <div className="auth-form-inner">
          <div>
            <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginLeft: -10, marginBottom: 16 }}>
              <Icon name="arrow-left" size={16} /> Back to home
            </button>
          </div>
          <div className="brand">
            <BrandMark size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>MedicaCare</div>
              <div className="t-muted" style={{ fontSize: 12 }}>Patient portal</div>
            </div>
          </div>
          <SplitText tag="h1" text="Welcome back" splitType="chars" delay={30} duration={0.9} textAlign="left" rootMargin="0px" />
          <AnimatedContent distance={20} duration={0.5} delay={0.55}>
            <p className="sub">Log in to book appointments and view your records.</p>
          </AnimatedContent>

          {authError && (
            <div role="alert" style={{ background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Icon name="alert-circle" size={16} style={{ marginTop: 1 }} />
              <div>{authError}</div>
            </div>
          )}

          <form onSubmit={submit} className="form-stack" noValidate>
            <Field label="Email address" required error={errors.email}>
              <TextInput type="email" placeholder="you@example.com" value={form.email}
                onChange={e => update('email', e.target.value)} error={errors.email} icon="mail" />
            </Field>
            <PwField label="Password" required error={errors.password} autoComplete="current-password"
              value={form.password} onChange={e => update('password', e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="checkbox">
                <input type="checkbox" checked={form.remember} onChange={e => update('remember', e.target.checked)} />
                <span>Remember me</span>
              </label>
              <a href="#/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>Forgot password?</a>
            </div>

            <button type="submit" className={`btn btn-primary lg ${loading ? 'btn-loading' : ''}`}>
              Log in
            </button>

            <div className="footer-link">
              New here? <a href="#/register">Create an account</a>
            </div>
          </form>
        </div>
      </div>
      </AnimatedContent>

    </main>
  );
}

export { Login };

