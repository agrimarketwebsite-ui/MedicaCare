// AdminLogin — public (split from screens-public.jsx)
import { useState } from 'react';
import { BrandMark, Field, Icon, navigate, TextInput, useStore } from '../shared/components.jsx';
import { api, setAccessToken } from '../shared/api.js';
import Aurora from '../shared/reactbits/Aurora.jsx';
import SplitText from '../shared/reactbits/SplitText.jsx';
import AnimatedContent from '../shared/reactbits/AnimatedContent.jsx';

// ---------- Admin login (staff console) ----------
// Separate, unlinked login for hospital staff/admin. Kept off the public
// patient login on purpose — patients never see staff entry points, and the
// admin console routes are guarded so this page is the only way in.
// Phase 2 — ang staff credentials ay vine-verify ng backend (admins table);
// ang role checks ay nasa API (requireRole) sa bawat request.

function AdminLogin() {
  const store = useStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);
  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); setAuthError(null); };

  // Phase 2 — POST /api/auth/login na may role:'admin' (ibang account source,
  // parehong JWT flow). Walang OTP step (prototype demo lang).
  const submit = async (evt) => {
    evt.preventDefault();
    const e = {};
    if (!form.email.trim()) e.email = 'Staff email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid staff email address';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setAuthError(null);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: form.email.trim(), password: form.password, role: 'admin' },
        auth: false,
      });
      setAccessToken(data.accessToken);
      const p = data.profile;
      store.loginAdmin({ ...p, name: p.full_name });
      store.setRole('admin');
      navigate('/admin/dashboard');
    } catch (err) {
      // Generic message — does not reveal whether the staff account exists
      setAuthError(err.status === 401 ? 'Invalid staff credentials. Please try again.' : (err.message || 'Sign in failed. Please try again.'));
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
          <div className="quote">"Behind every smooth appointment is a team that keeps the whole clinic in sync."</div>
          <div className="attrib">MedicaCare · Staff console</div>
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
              <div className="t-muted" style={{ fontSize: 12 }}>Staff console</div>
            </div>
          </div>
          <SplitText tag="h1" text="Staff sign in" splitType="chars" delay={30} duration={0.9} textAlign="left" rootMargin="0px" />
          <AnimatedContent distance={20} duration={0.5} delay={0.55}>
            <p className="sub">Restricted access for authorized hospital staff only.</p>
          </AnimatedContent>

          {authError && (
            <div role="alert" style={{ background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error-text)', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Icon name="alert-circle" size={16} style={{ marginTop: 1 }} />
              <div>{authError}</div>
            </div>
          )}

          <form onSubmit={submit} className="form-stack" noValidate>
            <Field label="Staff email" required error={errors.email}>
              <TextInput type="email" placeholder="staff@medicacare.ph" value={form.email}
                onChange={e => update('email', e.target.value)} error={errors.email} icon="mail" />
            </Field>
            <Field label="Password" required error={errors.password}>
              <TextInput type="password" placeholder="Enter your password" value={form.password}
                onChange={e => update('password', e.target.value)} error={errors.password} />
            </Field>

            <button type="submit" className={`btn btn-primary lg ${loading ? 'btn-loading' : ''}`}>
              Sign in to console
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

export { AdminLogin };

