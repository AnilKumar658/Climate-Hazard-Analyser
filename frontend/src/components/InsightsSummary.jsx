/**
 * InsightsSummary: Statistical mini-cards with plain-language tooltips.
 * Preserves all statistical fields returned by the backend.
 */

const SEVERITY_CONFIG = {
  low:      { icon: '✅', label: 'Low Risk',      badgeClass: 'green'  },
  moderate: { icon: '⚠️',  label: 'Moderate Risk', badgeClass: 'yellow' },
  high:     { icon: '🔥', label: 'High Risk',     badgeClass: 'orange' },
  severe:   { icon: '🚨', label: 'Severe Risk',   badgeClass: 'red'    },
};

export default function InsightsSummary({ insights, trend, regionName, threshold, displayHazard }) {
  if (!insights || !trend) return null;

  const severity = SEVERITY_CONFIG[insights.severity] || SEVERITY_CONFIG.low;

  // Guard optional fields safely
  const pValue   = Number(trend.p_value ?? NaN);
  const mkP      = Number(trend.mann_kendall_p ?? NaN);
  const rSq      = Number(trend.r_squared ?? NaN);
  const slope    = Number(trend.slope ?? NaN);
  const pct      = Number(trend.percent_change ?? NaN);
  const mkTrend  = trend.mann_kendall_trend ?? '—';
  const threshDisp =
    threshold != null && Number.isFinite(Number(threshold))
      ? `${Number(threshold).toFixed(2)}${displayHazard?.unit ? ` ${displayHazard.unit}` : '°C'}`
      : null;

  const stats = [
    {
      label: 'Trend Slope',
      value: Number.isFinite(slope) ? `${slope > 0 ? '+' : ''}${slope.toFixed(3)} ev/yr` : '—',
      color: 'var(--text-primary)',
      tooltip: 'Linear regression slope (events per year)',
    },
    {
      label: '% Change',
      value: Number.isFinite(pct) ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—',
      color: pct > 10 ? '#F87171' : pct < -10 ? '#34D399' : 'var(--text-primary)',
      tooltip: 'Change from first 5-year block to last 5-year block',
    },
    {
      label: 'R² (linear)',
      value: Number.isFinite(rSq) ? rSq.toFixed(3) : '—',
      color: 'var(--text-primary)',
      tooltip: 'How well a straight line fits the data (0 = poor, 1 = perfect). A low R² means the linear model explains little variance.',
    },
    {
      label: 'p-value (OLS)',
      value: Number.isFinite(pValue) ? (pValue < 0.001 ? '<0.001' : pValue.toFixed(3)) : '—',
      color: Number.isFinite(pValue) && pValue < 0.05 ? '#34D399' : 'var(--text-secondary)',
      tooltip: 'p < 0.05 suggests the linear trend is statistically significant. Note: significance does not confirm causation.',
    },
    {
      label: 'Mann–Kendall',
      value: mkTrend,
      color: mkTrend === 'increasing' ? '#F87171' : mkTrend === 'decreasing' ? '#34D399' : 'var(--text-primary)',
      tooltip: `Non-parametric monotonic trend test. p = ${Number.isFinite(mkP) ? mkP.toFixed(3) : '—'}. Tests whether the rank order of values has a consistent direction.`,
    },
    ...(threshDisp ? [{
      label: 'Threshold',
      value: threshDisp,
      color: 'var(--text-primary)',
      tooltip: `${displayHazard?.thresholdLabel ?? 'Detection threshold'} — the value above/below which an event is counted.`,
    }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Statistical note (Mann-Kendall vs OLS can disagree) */}
      {Number.isFinite(pValue) && Number.isFinite(mkP) && (pValue < 0.05) !== (mkP < 0.05) && (
        <div style={{
          padding: '0.6rem 0.75rem',
          background: 'rgba(251,191,36,0.07)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--accent-yellow)' }}>Note:</strong> The linear regression and Mann–Kendall tests disagree on statistical significance. This can occur because they test different aspects: OLS measures linear fit strength, while Mann–Kendall tests for consistent rank-order direction. Both results are shown above.
        </div>
      )}

      {/* Mini stat cards */}
      <div className="mini-stats-grid">
        {stats.map((s) => (
          <MiniStat key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, tooltip }) {
  return (
    <div className="mini-stat-card tooltip-wrap">
      <div className="mini-stat-card__label">{label}</div>
      <div className="mini-stat-card__value" style={{ color }}>
        {value}
      </div>
      {tooltip && (
        <div className="tooltip-content" role="tooltip">{tooltip}</div>
      )}
    </div>
  );
}
