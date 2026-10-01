// auth.jsx — split from components.jsx (layered shared UI)
import { useEffect, useId, useRef, useState } from 'react';
import brandLogo from '../assets/brand_logo.png';
import './data.js';
import AnimatedContent from './reactbits/AnimatedContent.jsx';
import { Icon } from './icons.jsx';
import { Field, generateOtp, Modal } from './ui.jsx';

function OtpVerifyModal({ open, onClose, onVerified, email, title = 'Verify it\'s you', subtitle }) {
  const [sentCode, setSentCode] = useState('');
  const [entry, setEntry] = useState(() => Array(6).fill(''));
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [resend, setResend] = useState(0);
  const inputRefs = useRef([]);

  // (Re)send: a fresh code each time the modal opens or Resend is clicked.
  // The short "sending" window is the same simulated-fetch theater the other
  // flows use (skeletons/spinners for ~600–900ms).
  useEffect(() => {
    if (!open) return undefined;
    setSentCode(generateOtp());
    setEntry(Array(6).fill(''));
    setError('');
    setSending(true);
    const t = setTimeout(() => setSending(false), 900);
    requestAnimationFrame(() => { if (inputRefs.current[0]) inputRefs.current[0].focus(); });
    return () => clearTimeout(t);
  }, [open, resend]);

  const submit = (value) => {
    const code = (value || entry.join('')).toUpperCase();
    if (code.length < 6) { setError('Enter all 6 characters of the code.'); return; }
    if (code !== sentCode) {
      setError('That code doesn\'t match. Check it and try again, or resend a new code.');
      return;
    }
    onVerified();
  };

  const setChar = (i, raw) => {
    const c = String(raw || '').replace(/[^0-9a-zA-Z]/g, '').slice(-1).toUpperCase();
    const next = entry.slice();
    next[i] = c;
    setEntry(next);
    if (error) setError('');
    if (c && i < 5) inputRefs.current[i + 1].focus();
    // All 6 filled — verify automatically, no button press needed
    if (next.every(x => x)) submit(next.join(''));
  };

  const onInputKey = (i, e) => {
    if (e.key === 'Backspace' && !entry[i] && i > 0) inputRefs.current[i - 1].focus();
    // Arrow keys move between boxes like a normal code input
    if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1].focus();
    if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1].focus();
  };

  const onPaste = (i, e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6 - i);
    if (!text) return;
    const next = entry.slice();
    text.split('').forEach((ch, k) => { next[i + k] = ch; });
    setEntry(next);
    const fill = next.findIndex(x => !x);
    inputRefs.current[fill === -1 ? 5 : fill].focus();
    if (next.every(x => x)) submit(next.join(''));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon="mail-check"
      iconKind="info"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => submit()}>Verify code</button>
        </>
      }
    >
      <div className="stack md">
        {/* Demo notice — this prototype sends no real email, so the "emailed"
            code is shown here. Labeled clearly so it never reads as a leak. */}
        <div className="otp-demo-box" role="note">
          <Icon name="info" size={14} />
          <div style={{ flex: 1 }}>
            <div><strong>Prototype demo:</strong> no real email is sent. Your code would arrive at <strong>{email || 'your inbox'}</strong> — it is shown here instead.</div>
            <div className="otp-demo-code" aria-label="Your verification code">
              {sending
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending code to your Gmail…</span>
                : sentCode}
            </div>
          </div>
        </div>

        <Field label="Enter the 6-character code" error={error}>
          <div className="otp-inputs">
            {entry.map((ch, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                className={'input otp-input' + (error ? ' error' : '')}
                value={ch}
                autoComplete="one-time-code"
                inputMode="text"
                aria-label={`Character ${i + 1} of 6`}
                onChange={e => setChar(i, e.target.value)}
                onKeyDown={e => onInputKey(i, e)}
                onPaste={e => onPaste(i, e)}
              />
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-link" disabled={sending} onClick={() => setResend(r => r + 1)}>
            Resend a new code
          </button>
          <span className="t-help">Tip: the code mixes 3 numbers and 3 letters — case doesn't matter.</span>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Password input with show/hide toggle ----------
// Small shared wrapper so every password field (patient login, profile change
// password) gets the eye toggle without each screen re-implementing it.
function PwField({ label, required, error, help, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <Field label={label} required={required} error={error} help={help} htmlFor={id}>
      <div className="input-group">
        <input
          id={id}
          className={'input' + (error ? ' error' : '')}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          // Tandaan: ang `.input-group .input` CSS ay nagse-set ng
          // padding-left:38px para sa left-icon inputs — walang left icon dito
          // kaya ibalik sa normal na 12px para mag-align ang text sa ibang fields.
          style={{ paddingRight: 40, paddingLeft: 12 }}
        />
        <button
          type="button"
          className="pw-toggle"
          aria-label={show ? 'Hide password' : 'Show password'}
          title={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow(s => !s)}
        >
          <Icon name={show ? 'eye-off' : 'eye'} size={16} />
        </button>
      </div>
    </Field>
  );
}

// ---------- Export everything ----------

export { OtpVerifyModal, PwField };
