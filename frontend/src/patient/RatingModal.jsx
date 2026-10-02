// RatingModal — patient (Phase 4)
// Star picker 1–5 + optional comment → POST /api/ratings.
// Reachable only for completed appointments; the backend enforces one rating
// per appointment (409 kapag rated na) — ang UI ay nagtatago na ng action
// kapag alam nang na-rate (local record mula sa matagumpay na submit).
import { useEffect, useState } from 'react';
import { Field, Icon, Modal, TextArea, useStore } from '../shared/components.jsx';
import { submitRating, ApiError } from '../shared/api.js';

function RatingModal({ open, appointment, onClose, onSuccess }) {
  const store = useStore();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setStars(0); setComment(''); setError(''); setSaving(false); } }, [open ]);

  if (!appointment) return null;

  const submit = async () => {
    if (!stars) { setError('Please choose a star rating.'); return; }
    setSaving(true);
    setError('');
    try {
      await submitRating({
        appointment_id: appointment.id,
        stars,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      // Local record para maitago ang "Rate your visit" action sa susunod —
      // ang backend ang tunay na source (409 kapag rated na), ito ay UI cache lang
      const record = { appointmentId: appointment.id, stars, comment: comment.trim(), createdAt: new Date().toISOString().slice(0, 10) };
      store.setRatings([...(store.ratings || []), record]);
      store.pushToast({ title: 'Thank you for your feedback', msg: `Your ${stars}-star rating has been recorded.` });
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Na-rate na pala (hal. mula sa ibang device) — itago ang action at
        // huwag nang ipilit
        store.setRatings([...(store.ratings || []), { appointmentId: appointment.id, stars, comment: comment.trim(), createdAt: new Date().toISOString().slice(0, 10) }]);
        setError('This visit has already been rated. Thank you!');
      } else {
        setError(err.message || 'Hindi na-save ang rating. Pakisubukang muli.');
      }
    } finally {
      setSaving(false);
    }
  };

  const doctorName = appointment.doctorName || appointment.doctor?.full_name || '';
  const when = appointment.date && appointment.timeDisplay
    ? `${appointment.date} · ${appointment.timeDisplay}`
    : '';

  return (
    <Modal
      open={open} onClose={onClose}
      title="Rate your visit"
      subtitle={doctorName ? `${doctorName}${when ? ` · ${when}` : ''}` : when}
      icon="star" iconKind="success"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={submit} disabled={saving}>Submit rating</button>
      </>}
    >
      <div className="stack md">
        <Field label="How was your visit?" required error={error}>
          <div className="rate-star-row">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n} type="button"
                className={'rate-star' + (n <= stars ? ' on' : '')}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                aria-pressed={n <= stars}
                onClick={() => { setStars(n); setError(''); }}
              >
                <Icon name="star" size={26} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Comment" help="Optional. Share what went well or what could improve.">
          <TextArea
            rows={3}
            placeholder="Your feedback helps other patients and helps us improve."
            value={comment}
            onChange={e => setComment(e.target.value)}
            maxLength={300}
          />
        </Field>
        <p className="t-muted" style={{ fontSize: 12, margin: 0 }}>
          Ratings are displayed with the number of reviews. Only patients with a completed appointment can rate, once per visit.
        </p>
      </div>
    </Modal>
  );
}

export { RatingModal };
