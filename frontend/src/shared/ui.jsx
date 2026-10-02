// ui.jsx — split from components.jsx (layered shared UI)
import { useEffect, useRef, useState } from 'react';
import brandLogo from '../assets/brand_logo.png';
import { randomInt } from './data.js';
import AnimatedContent from './reactbits/AnimatedContent.jsx';
import { Icon } from './icons.jsx';
import { useStore } from './store.jsx';

// ---------- Badge ----------
function Badge({ children, kind = 'neutral', dot = true }) {
  const cls = kind.startsWith('badge-') ? kind : `badge-${kind}`;
  return <span className={`badge ${cls}`}>{dot && <span className="badge-dot" />}{children}</span>;
}

function StatusBadge({ status }) {
  const m = window.statusMeta(status);
  return <span className={`badge ${m.cls}`}><span className="badge-dot" />{m.label}</span>;
}

function DoctorStatusBadge({ status }) {
  const m = window.doctorStatusMeta(status);
  return <span className={`badge ${m.cls}`}><span className="badge-dot" />{m.label}</span>;
}

// ---------- Doctor avatar (photo with initials fallback) ----------
// Doctors carry a dummy portrait URL (randomuser.me). If the photo is missing
// or fails to load (e.g. offline demo), fall back to the initials circle.
function DoctorAvatar({ doctor, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const photo = doctor?.photo;
  useEffect(() => { setFailed(false); }, [photo]);
  const name = doctor?.name || '?';
  if (!photo || failed) {
    return (
      <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), flexShrink: 0 }}>
        {window.initials(name)}
      </div>
    );
  }
  return (
    <img
      src={photo}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
    />
  );
}

// ---------- Patient avatar (photo with initials fallback) ----------
// Same behavior as DoctorAvatar, for patient records (seed patients carry a
// randomuser.me portrait; uploaded photos override via data URLs).
function PatientAvatar({ person, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const photo = person?.photo;
  useEffect(() => { setFailed(false); }, [photo]);
  const name = person?.name || '?';
  if (!photo || failed) {
    return (
      <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), flexShrink: 0 }}>
        {window.initials(name)}
      </div>
    );
  }
  return (
    <img
      src={photo}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
    />
  );
}

// ---------- Modal ----------
function Modal({ open, onClose, title, subtitle, icon, iconKind = 'info', size = '', children, footer }) {
  const modalRef = useRef(null);
  // Ang onClose ay kadalasang inline arrow mula sa caller, kaya nagbabago ang
  // identity nito sa bawat render. Kung isasama ito sa effect deps, ang focus
  // effect ay tumatakbo ulit sa bawat keystroke: ang cleanup ay ibinabalik
  // ang focus sa pinagmulan (prevFocus.focus()), kaya nawawala ang focus ng
  // input sa bawat type. Sa pamamagitan ng ref, ang focus trap ay tumatakbo
  // lang sa open/close transition, pero laging latest ang onClose na ginagamit.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement;
    // Dialog focus pattern (audit-002 #13): move focus into the dialog when
    // it opens, trap Tab inside it, and restore focus to the trigger on close
    requestAnimationFrame(() => { if (modalRef.current) modalRef.current.focus(); });
    const onKey = (e) => {
      if (e.key === 'Escape') { const fn = onCloseRef.current; fn && fn(); return; }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) { e.preventDefault(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === modalRef.current)) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div ref={modalRef} className={`modal ${size}`} role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
            {icon && (
              <div className={`modal-icon ${iconKind}`}>
                <Icon name={icon} size={22} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div className="modal-title">{title}</div>
              {subtitle && <div className="modal-sub">{subtitle}</div>}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close dialog"><Icon name="x" size={16} /></button>
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toast ----------
function ToastLayer() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="toast-icon">
            <Icon name={
              t.kind === 'error' ? 'x-circle' :
              t.kind === 'warning' ? 'alert-triangle' :
              t.kind === 'info' ? 'info' : 'check-circle-2'
            } size={17} />
          </div>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            {t.msg && <div className="toast-msg">{t.msg}</div>}
          </div>
          <button className="toast-close" onClick={() => dismissToast(t.id)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Field wrappers ----------
function Field({ label, required, help, error, htmlFor, children }) {
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={htmlFor}>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {error
        ? <div className="field-error"><Icon name="alert-circle" size={12} /> {error}</div>
        : help ? <div className="field-help">{help}</div> : null}
    </div>
  );
}

function TextInput({ error, icon, ...props }) {
  if (icon) {
    return (
      <div className="input-group">
        <Icon name={icon} size={16} className="input-icon" />
        <input className={'input' + (error ? ' error' : '')} {...props} />
      </div>
    );
  }
  return <input className={'input' + (error ? ' error' : '')} {...props} />;
}

function TextArea({ error, ...props }) {
  return <textarea className={'textarea' + (error ? ' error' : '')} {...props} />;
}

function SelectInput({ error, children, className, 'aria-label': ariaLabel, ...props }) {
  // Merge an optional extra class (e.g. .status-select) with the base .select
  // Falls back to the first option's text so a bare select is never unnamed
  // for screen readers (Lighthouse select-name)
  const label = ariaLabel ?? ((Array.isArray(children) && children[0]?.props?.children) || undefined);
  return <select className={'select' + (error ? ' error' : '') + (className ? ' ' + className : '')} aria-label={label} {...props}>{children}</select>;
}

// ---------- Pagination ----------
function Pagination({ page, setPage, total, pageSize, label = 'rows' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const list = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) list.push(i);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  return (
    <div className="pagination">
      <div>Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong> {label}</div>
      <div className="pagination-controls">
        <button className="page-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <Icon name="chevron-left" size={14} />
        </button>
        {list.map((p, i) => p === '…'
          ? <span key={i} className="t-muted" style={{ padding: '0 4px' }}>…</span>
          : <button key={i} className={'page-btn' + (page === p ? ' on' : '')} aria-label={`Page ${p}`} onClick={() => setPage(p)}>{p}</button>
        )}
        <button className="page-btn" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------- Skeleton rows for tables ----------
function SkeletonRows({ rows = 6, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><span className="skel" style={{ height: 12, width: c === 0 ? '70%' : c === cols - 1 ? '40%' : '60%' }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------- Sortable table header button (guideline 18 — table sorting) ----------
// Shared by the admin tables and the patient Appointment History table.
// Keyboard-accessible (<button>), exposes state via aria-sort, and keeps the
// chevron affordance visible in both sorted and unsorted columns.
function SortableTh({ label, k, sortKey, sortDir, onSort }) {
  const active = sortKey === k;
  return (
    <th aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => onSort(k)}>
        {label}
        <Icon name={active ? (sortDir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} size={12} />
      </button>
    </th>
  );
}

// ---------- Page loading spinner ----------
// Full-page loading state for form-heavy pages (patient Book/Profile, admin
// Settings) where a single centered circle reads better than layout skeletons.
// The flex wrapper centers the circle on both axes within the visible content
// area — identical on desktop and mobile.
function PageSpinner() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div className="spinner" />
    </div>
  );
}

// ---------- Empty / Error state ----------
function EmptyState({ icon = 'inbox', title, message, actions }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name={icon} size={22} /></div>
      <div className="empty-state-title">{title}</div>
      {message && <div className="empty-state-msg">{message}</div>}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  );
}

function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ background: 'var(--error-soft)', color: 'var(--error)' }}>
        <Icon name="alert-triangle" size={22} />
      </div>
      <div className="empty-state-title">{title}</div>
      {message && <div className="empty-state-msg">{message}</div>}
      {onRetry && (
        <div className="empty-state-actions">
          <button className="btn btn-secondary" onClick={onRetry}><Icon name="refresh-cw" size={14} /> Retry</button>
        </div>
      )}
    </div>
  );
}

// ---------- Confirm modal (delete/cancel) ----------
function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', kind = 'danger', loading = false }) {
  const iconMap = { danger: 'alert-triangle', warning: 'alert-circle', info: 'info', success: 'check-circle-2' };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={message}
      icon={iconMap[kind]}
      iconKind={kind}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Keep it</button>
          <button className={`btn ${kind === 'danger' ? 'btn-danger' : 'btn-primary'} ${loading ? 'btn-loading' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

// ---------- OTP verification (prototype demo) ----------
// Second login step for every portal: a 6-character code "emailed" to the
// user — 3 digits + 3 letters, shuffled so the two mix. PROTOTYPE ONLY: no
// real email is sent; the code is displayed in the modal's demo notice so
// the demo flow stays completable. A real backend must generate, deliver,
// and expire these codes server-side (and rate-limit the attempts).
function generateOtp() {
  const digits = '0123456789';
  // Unambiguous letter charset (no I/L/O) so a code read from the demo box
  // is easy to re-type — same rule as the generated portal passwords
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  // randomInt rejection-samples, so every character is equally likely
  const pick = (set) => set[randomInt(set.length)];
  const chars = [pick(digits), pick(digits), pick(digits), pick(letters), pick(letters), pick(letters)];
  // Fisher–Yates shuffle so digits and letters mix instead of clustering
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export { Badge, StatusBadge, DoctorStatusBadge, DoctorAvatar, PatientAvatar, Modal, ToastLayer, Field, TextInput, TextArea, SelectInput, Pagination, SkeletonRows, SortableTh, PageSpinner, EmptyState, ErrorState, ConfirmModal, generateOtp };

