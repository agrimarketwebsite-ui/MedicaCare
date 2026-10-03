// admin/charts.jsx — simple SVG bar chart (no external deps).
// Props: data = [{ label, value }], height (px). Ginagamit ng AdminDashboard
// at AdminReports para sa appointments-per-day at specialty breakdown.
function BarChart({ data = [], height = 170 }) {
  const rows = (data || []).filter(d => d && d.label !== undefined);
  const max = Math.max(...rows.map(d => Number(d.value) || 0), 1);
  const n = rows.length;
  const labelH = 22;             // room for x-axis labels
  const valueH = 16;            // room for value labels above bars
  const plotH = height - labelH - valueH;
  const W = 640;                // viewBox width; CSS scales it responsively
  const slot = n > 0 ? W / n : W;
  const barW = Math.min(slot * 0.56, 56);

  return (
    <div role="img" aria-label="Bar chart">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }}>
        {rows.map((d, i) => {
          const v = Number(d.value) || 0;
          const bh = Math.max((v / max) * plotH, 2);
          const x = slot * i + (slot - barW) / 2;
          const y = valueH + (plotH - bh);
          return (
            <g key={i}>
              <text x={slot * i + slot / 2} y={valueH - 4} textAnchor="middle"
                fontSize="12" fontWeight="700" fill="var(--text-secondary)">
                {v}
              </text>
              <rect x={x} y={y} width={barW} height={bh} rx="4"
                fill="var(--primary)" opacity={v === 0 ? 0.25 : 0.9} />
              <text x={slot * i + slot / 2} y={height - 6} textAnchor="middle"
                fontSize="11" fill="var(--text-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
        {n === 0 && (
          <text x={W / 2} y={height / 2} textAnchor="middle" fontSize="13" fill="var(--text-muted)">
            No data
          </text>
        )}
      </svg>
    </div>
  );
}

export { BarChart };
