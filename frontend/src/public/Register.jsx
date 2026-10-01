// Register — public (split from screens-public.jsx)
import { useState } from 'react';
import { BrandMark, Field, Icon, navigate, TextInput, useStore } from '../shared/components.jsx';
import { api } from '../shared/api.js';
import Aurora from '../shared/reactbits/Aurora.jsx';
import SplitText from '../shared/reactbits/SplitText.jsx';
import AnimatedContent from '../shared/reactbits/AnimatedContent.jsx';

// ---------- Register ----------
function Register() {
  const store = useStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const update = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    else if (form.name.trim().length < 3) e.name = 'Please enter your full name';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Use at least 8 characters';
    if (!form.confirm) e.confirm = 'Please confirm your password';
    else if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    if (!form.agree) e.agree = 'You must accept the terms';
    return e;
  };

  // Phase 2 — ang account ay ginagawa sa backend (POST /api/auth/register),
  // hindi na sa localStorage. Ang 409 mula sa backend ay naka-map sa email error.
  const submit = async (evt) => {
    evt.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          full_name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        },
        auth: false,
      });
      store.pushToast({ title: 'Account created', msg: 'You can now log in with your new credentials.' });
      navigate('/login');
    } catch (err) {
      if (err.status === 409) {
        setErrors({ email: 'An account with this email already exists. Try logging in instead.' });
      } else if (err.details && err.details.length) {
        // Backend zod errors → i-map sa form fields
        const fieldMap = { full_name: 'name', email: 'email', phone: 'phone', password: 'password' };
        const fe = {};
        for (const d of err.details) {
          const key = fieldMap[d.path] || d.path;
          if (!fe[key]) fe[key] = d.message;
        }
        setErrors(fe);
      } else {
        store.pushToast({ kind: 'error', title: 'Registration failed', msg: err.message || 'Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" reverse duration={0.7}>
      <div className="auth-form-col auth-compact">
        <div className="auth-form-inner">
          <div>
            <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginLeft: -10, marginBottom: 8 }}>
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
          <SplitText tag="h1" text="Create your account" splitType="chars" delay={30} duration={0.9} textAlign="left" rootMargin="0px" />
          <AnimatedContent distance={20} duration={0.5} delay={0.55}>
            <p className="sub">It only takes a minute. All fields are required.</p>
          </AnimatedContent>

          <form onSubmit={submit} className="form-stack" noValidate>
            <Field label="Full name" required error={errors.name}>
              <TextInput placeholder="Juan Miguel Bautista" value={form.name}
                onChange={e => update('name', e.target.value)} error={errors.name} />
            </Field>
            <Field label="Email address" required error={errors.email}>
              <TextInput type="email" placeholder="you@example.com" value={form.email}
                onChange={e => update('email', e.target.value)} error={errors.email} icon="mail" />
            </Field>
            <Field label="Phone number" required error={errors.phone} help={!errors.phone && 'We use this for appointment reminders only.'}>
              <TextInput type="tel" placeholder="+63 917 000 0000" value={form.phone}
                onChange={e => update('phone', e.target.value)} error={errors.phone} icon="phone" />
            </Field>
            <div className="form-2col">
              <Field label="Password" required error={errors.password}>
                <TextInput type="password" placeholder="Min 8 characters" value={form.password}
                  onChange={e => update('password', e.target.value)} error={errors.password} />
              </Field>
              <Field label="Confirm password" required error={errors.confirm}>
                <TextInput type="password" placeholder="Re-enter password" value={form.confirm}
                  onChange={e => update('confirm', e.target.value)} error={errors.confirm} />
              </Field>
            </div>
            <label className="checkbox" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={form.agree} onChange={e => update('agree', e.target.checked)} />
              <span>I agree to MedicaCare's <a href="#/terms" style={{ color: 'var(--primary)' }}>Terms of Service</a> and <a href="#/privacy" style={{ color: 'var(--primary)' }}>Privacy Policy</a>.</span>
            </label>
            {errors.agree && <div className="field-error"><Icon name="alert-circle" size={12} /> {errors.agree}</div>}

            <button type="submit" className={`btn btn-primary lg ${loading ? 'btn-loading' : ''}`}>
              Create account
            </button>

            <div className="footer-link">
              Already have an account? <a href="#/login">Log in</a>
            </div>
            {/* KoruUX patient-portal practice: state who can see the patient's
                data at the moment they hand it over (matches the Privacy page). */}
            <div className="auth-trust-line">
              <Icon name="shield-check" size={13} />
              <span>Your records are visible only to you and authorized MedicaCare staff.</span>
            </div>
          </form>
        </div>
      </div>
      </AnimatedContent>

      <AnimatedContent className="auth-slide" distance={260} direction="horizontal" duration={0.7}>
      <div className="auth-visual-col auth-visual-col--register">
        <div className="auth-aurora" aria-hidden="true"><Aurora colorStops={['#60A5FA', '#E0F2FE', '#3B82F6']} amplitude={1.1} speed={0.6} blend={0.7} /></div>
        <BrandMark className="brand-mark" />
        <div>
          <div className="quote">"Booking my cardiology follow-up used to take a whole afternoon of phone calls. Now I do it in two taps before work."</div>
          <div className="attrib">Sofia R. · fictional patient story</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          MedicaCare · Quezon City, PH
        </div>
      </div>
      </AnimatedContent>
    </main>
  );
}

export { Register };

