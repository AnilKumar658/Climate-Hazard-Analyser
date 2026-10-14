/**
 * DurationHeatmap: Year-by-year hazard duration grid.
 * Horizontally scrollable on small screens. Distinguishes zero vs. missing data.
 * Uses the displayHazard unit label dynamically.
 */
import { useMemo } from 'react';

function getColor(value, max) {
  if (value === 0) return 'rgba(255, 255, 255, 0.02)';
  const t = Math.min(value / max, 1);
  const alpha = 0.2 + t * 0.75;
  return `rgba(14, 165, 233, ${alpha.toFixed(2)})`;
}

const LEGEND_STOPS = [0.05, 0.2, 0.4, 0.6, 0.8, 1.0];

export default function DurationHeatmap({ yearlyStats, displayHazard }) {
  const durationLabel = displayHazard?.durationLabel || 'Hazard Days';
  const unitLabel     = 'days';

  const maxDays = useMemo(
    () => Math.max(...(yearlyStats ?? []).map((s) => s.total_duration_days ?? 0), 1),
    [yearlyStats]
  );

  // Group into rows of 10 years each
  const rows = useMemo(() => {
    if (!yearlyStats?.length) return [];
    const result = [];
    for (let i = 0; i < yearlyStats.length; i += 10) {
      result.push(yearlyStats.slice(i, i + 10));
    }
    return result;
  }, [yearlyStats]);

  if (!rows.length) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No annual data to display.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div className="heatmap-scroll" role="img" aria-label={`${durationLabel} per year heatmap`}>
        {rows.map((row, ri) => (
          <div key={ri} className="heatmap-row">
            {row.map((stat) => {
              const days = stat.total_duration_days ?? 0;
              return (
                <div
                  key={stat.year}
                  className="heatmap-cell"
                  title={`${stat.year}: ${days} ${unitLabel} (${stat.event_count ?? 0} events)`}
                  aria-label={`${stat.year}: ${days} ${unitLabel}`}
                  style={{ background: getColor(days, maxDays) }}
                >
                  <span className="heatmap-cell__year">{stat.year}</span>
                  <span className={`heatmap-cell__value${days === 0 ? ' heatmap-cell__value--zero' : ''}`}>
                    {days > 0 ? days : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend" aria-label="Color legend">
        <span className="heatmap-legend__label">0</span>
        {LEGEND_STOPS.map((t) => (
          <div
            key={t}
            className="heatmap-legend__swatch"
            style={{ background: getColor(Math.round(t * maxDays), maxDays) }}
            aria-hidden="true"
          />
        ))}
        <span className="heatmap-legend__label">{maxDays} {unitLabel}</span>
      </div>
    </div>
  );
}
