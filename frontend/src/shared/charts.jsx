// charts.jsx — split from components.jsx (layered shared UI)
import { useEffect, useRef, useState } from 'react';
import brandLogo from '../assets/brand_logo.png';
import './data.js';
import AnimatedContent from './reactbits/AnimatedContent.jsx';
import { Icon } from './icons.jsx';

// ---------- Simple placeholder chart (visits over week) ----------
// Optional `trend` draws a line connecting the bar tops.
function MiniBarChart({ data, height = 120, trend = false, delay = 0, stagger = 80 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const n = data.length || 1;
  // Tallest bar uses this % of the chart height; the rest is headroom for the value labels
  const BAR_MAX = 82;

  // The trend line renders at its true pixel size (viewBox matches the
  // container exactly, no stretching) instead of a distorted 100x100 viewBox.
  // This avoids the Chrome dash-rendering artifacts on non-scaling-stroke +
  // preserveAspectRatio="none", and lets the draw-in animation trace the
  // path correctly ("walking" along the bar tops from start to end).
  const chartRef = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!trend || !chartRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [trend]);
  return (
    <div>
      <div ref={chartRef} style={{ position: 'relative', height }}>
        {trend && n > 1 && width > 0 && (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
            className="mini-chart-trend"
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1, animationDelay: `${delay + n * stagger}ms` }}>
            {/* pathLength=100 + dash-offset draw: at 1:1 pixel scale this
                traces the line along the bar tops from start to end */}
            <polyline
              points={data.map((d, i) => `${((i + 0.5) / n) * width},${((100 - (d.value / max) * BAR_MAX) / 100) * height}`).join(' ')}
              pathLength="100" className="chart-draw"
              fill="none" stroke="var(--primary)" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
          </svg>
        )}
        {trend && data.map((d, i) => (
          <div key={`pt-${i}`} className="chart-dot" style={{
            position: 'absolute', zIndex: 2,
            left: `${((i + 0.5) / n) * 100}%`,
            top: `${100 - (d.value / max) * BAR_MAX}%`,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--primary)', border: '2px solid #fff',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.2)',
            // each dot pops as the drawn line reaches it (line duration: 900ms)
            animationDelay: `${(delay + n * stagger) + (n > 1 ? (i / (n - 1)) * 900 : 0)}ms`,
          }} />
        ))}
        {data.map((d, i) => (
          <div key={i} className="mini-chart-col" style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${(i / n) * 100}%`, width: `${100 / n}%`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{d.value}</div>
            <div className={'mini-chart-bar' + (d.highlight ? ' on' : '')} style={{
              width: '100%', maxWidth: 40,
              height: `${Math.max((d.value / max) * BAR_MAX, 1)}%`,
              // staggered wave: each bar starts after the previous one;
              // `delay` holds the whole sequence briefly after loading clears
              animationDelay: `${delay + i * stagger}ms`,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ width: `${100 / n}%`, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

// ---------- Sparkline (tiny trend line for stat cards) ----------
// No axes or labels — the number beside it is the data; the line only
// communicates direction. Fixed viewBox matching its pixel size so the
// end dot doesn't distort under non-uniform scaling. `delay` staggers
// multiple sparklines (e.g. one per stat card) after the skeletons clear.
function Sparkline({ data, width = 72, height = 28, tone = 'primary', delay = 0 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => [
    1 + (i / (data.length - 1)) * (width - 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const line = pts.map(p => p.join(',')).join(' ');
  const last = pts[pts.length - 1];
  const color = tone === 'success' ? 'var(--success)' : tone === 'error' ? 'var(--error)' : 'var(--primary)';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="sparkline">
      {/* pathLength=100 normalizes the draw-in dash animation for any shape */}
      <polyline points={line} pathLength="100" className="chart-draw"
        style={{ animationDelay: `${delay}ms` }}
        fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} className="chart-dot"
        style={{ animationDelay: `${delay + 900}ms` }} />
    </svg>
  );
}

// ---------- Doctor visit ratings (computed from real patient feedback) ----------
// Ratings come only from patients with a completed appointment (one rating per
// appointment, enforced again at submit time). Doctors start with no rating at
// all — nothing is displayed that patients did not actually give, and an
// average is always shown together with its review count (small samples stay
// labeled). Ratings are never used to sort or rank doctors.
function computeDoctorRating(ratings, doctorId) {
  const list = (ratings || []).filter(r => r.doctorId === doctorId);
  if (!list.length) return { count: 0, avg: null };
  const avg = list.reduce((s, r) => s + (Number(r.stars) || 0), 0) / list.length;
  return { count: list.length, avg: Math.round(avg * 10) / 10 };
}

// Phase 3 — ang `avg`/`count` props ay galing sa API (v_doctor_rating_averages)
// at nauuna sa local ratings kapag ibinigay; kung wala, local computation.
function DoctorRatingPill({ ratings, doctorId, compact = false, avg: avgProp, count: countProp }) {
  const computed = computeDoctorRating(ratings, doctorId);
  const count = countProp ?? computed.count;
  const avg = avgProp ?? computed.avg;
  if (!count) return <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No ratings yet</span>;
  const label = `${count} ${compact ? 'rating' : 'patient rating'}${count === 1 ? '' : 's'}`;
  return (
    <span
      className="rating-cell"
      style={{ fontSize: 12.5 }}
      // Hover detail for mouse users; the visible text already spells it out
      title={`Average of ${count} patient rating${count === 1 ? '' : 's'} from completed visits`}
    >
      <Icon name="star" size={13} style={{ color: 'var(--rating-star)' }} />
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{avg.toFixed(1)}</span>
      <span style={{ color: 'var(--text-muted)' }}>· {label}</span>
    </span>
  );
}

export { MiniBarChart, Sparkline, computeDoctorRating, DoctorRatingPill };

