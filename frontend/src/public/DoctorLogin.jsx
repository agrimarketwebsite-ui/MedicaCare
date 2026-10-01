// DoctorLogin — public (split from screens-public.jsx)
import { useEffect, useState } from 'react';
import { BrandMark, Field, Icon, navigate, TextInput, useStore } from '../shared/components.jsx';
import { api, setAccessToken } from '../shared/api.js';
import Aurora from '../shared/reactbits/Aurora.jsx';
import SplitText from '../shared/reactbits/SplitText.jsx';
import AnimatedContent from '../shared/reactbits/AnimatedContent.jsx';

// ---------- Doctor login (doctor portal) ----------
// Third prototype role: doctors log in to see their own schedule and write
// their own visit notes — the notes are attributed to the doctor who wrote
// them, not encoded by staff. Unlinked from the public site like the staff
// console; the URL is shared with doctors internally.
// Accounts are admin-issued: staff create them (email + password) from the
// Admin console's Doctors page, so this portal is login-only — doctors never
// self-register.
function DoctorLogin({ removed = false }) {
  const store = useStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);
  // A stale session for a doctor the staff console has removed is cleared
  // here (in an effect, not during render) so the next login starts clean
  useEffect(() => {
    if (removed && store.doctorSession) store.logoutDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removed]);

  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); setAuthError(null); };

  // Phase 2 — POST /api/auth/login na may role:'doctor' (doctor_accounts table).
  // Walang OTP step (prototype demo lang). WALANG directory gate dito: ang
  // doctor directory ay empty pa (Phase 5 pa ang doctors API), kaya ang API
  // mismo ang source of truth ng account. Ang display name ay email muna.
  const submit = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!form.email.trim()) e.email = 'Doctor email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid doctor email address';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setAuthError(null);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: form.email.trim(), password: form.password, role: 'doctor' },
        auth: false,
      });
      setAccessToken(data.accessToken);
      const p = data.profile;
      store.loginDoctor({ ...p, doctorId: p.doctor_id, name: p.email, email: p.email });
      store.setRole('doctor');
      navigate('/doctor/dashboard');
    } catch (err) {
      // Generic message — does not reveal whether the doctor account exists
      setAuthError(err.status === 401 ? 'Invalid doctor credentials. Please try again.' : (err.message || 'Sign in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" reverse duration={0.7}>
      <div className="auth-visual-col auth-visual-col--forgot" style={{ order: 0 }}>
        <div className="auth-aurora" aria-hidden="true"><Aurora colorStops={['#60A5FA', '#E0F2FE', '#3B82F6']} amplitude={1.1} speed={0.6} blend={0.7} /></div>
        <BrandMark className="brand-mark" />
        <div>
          <div className="quote">"My day, my patients, my notes — all in one place, so clinic time goes to care."</div>
          <div className="attrib">MedicaCare · Doctor portal</div>
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
              <div className="t-muted" style={{ fontSize: 12 }}>Doctor portal</div>
            </div>
          </div>
          <SplitText tag="h1" text="Doctor sign in" splitType="chars" delay={30} duration={0.9} textAlign="left" rootMargin="0px" />
          <AnimatedContent distance={20} duration={0.5} delay={0.55}>
            <p className="sub">See your schedule and complete visits with your own notes.</p>
          </AnimatedContent>

          {removed && (
            <div role="alert" style={{ background: 'var(--warning-soft)', border: '1px solid #F1D9A7', color: 'var(--warning-text)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Icon name="alert-circle" size={16} style={{ marginTop: 1 }} />
              <div>Your doctor account is no longer active. It may have been removed by clinic staff — please contact the administrator if you believe this is a mistake.</div>
            </div>
          )}
          {authError && (
            <div role="alert" style={{ background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Icon name="alert-circle" size={16} style={{ marginTop: 1 }} />
              <div>{authError}</div>
            </div>
          )}

          <form onSubmit={submit} className="form-stack" noValidate>
            <Field label="Doctor email" required error={errors.email}>
              <TextInput type="email" placeholder="doctor@medicacare.ph" value={form.email}
                onChange={e => update('email', e.target.value)} error={errors.email} icon="mail" />
            </Field>
            <Field label="Password" required error={errors.password}>
              <TextInput type="password" placeholder="Enter your password" value={form.password}
                onChange={e => update('password', e.target.value)} error={errors.password} />
            </Field>

            <button type="submit" className={`btn btn-primary lg ${loading ? 'btn-loading' : ''}`}>
              Sign in to doctor portal
            </button>

            <div className="footer-link">
              Patient? <a href="#/login">Use the patient portal instead</a>
            </div>
          </form>
        </div>
      </div>
      </AnimatedContent>

    </main>
  );
}

export { DoctorLogin };

