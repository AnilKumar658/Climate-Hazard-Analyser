/**
 * IntensityChart: Bubble chart showing hazard intensity vs year.
 * Each bubble = one year with events. Size = longest event duration.
 * Adapts axis labels and tooltips based on the hazard type.
 */
import {
  Chart as ChartJS,
  LinearScale, PointElement, Tooltip, Legend, Title,
} from 'chart.js';
import { Bubble } from 'react-chartjs-2';
import { useMemo } from 'react';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, Title);

const AXIS_COLOR = '#64748b';
const GRID_COLOR = 'rgba(255,255,255,0.05)';

export default function IntensityChart({ yearlyStats, displayHazard }) {
  const unit = displayHazard?.unit || '';

  const { data, options } = useMemo(() => {
    if (!yearlyStats?.length) return { data: null, options: null };

    const withEvents = yearlyStats.filter((s) => s.event_count > 0);
    if (!withEvents.length) return { data: null, options: null };

    const maxDuration  = Math.max(...withEvents.map((s) => s.longest_event_days ?? 0), 1);
    const maxIntensity = Math.max(...withEvents.map((s) => s.mean_intensity ?? 0), 1);

    const points = withEvents.map((s) => ({
      x: s.year,
      y: Number(s.mean_intensity ?? 0),
      r: Math.max(4, ((s.longest_event_days ?? 0) / maxDuration) * 22),
      _stat: s,
    }));

    const chartData = {
      datasets: [{
        label: 'Event Intensity',
        data: points,
        backgroundColor(ctx) {
          const val = ctx.raw?.y ?? 0;
          const alpha = 0.3 + 0.6 * (val / maxIntensity);
          return `rgba(14, 165, 233, ${Math.min(alpha, 0.9).toFixed(2)})`;
        },
        borderColor: '#38BDF8',
        borderWidth: 1,
      }],
    };

    const yLabel = unit
      ? `Mean Intensity (${unit} above threshold)`
      : 'Mean Intensity (above threshold)';

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,16,32,0.97)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          padding: 10,
          callbacks: {
            title: (ctx) => `Year: ${ctx[0].raw.x}`,
            label: (ctx) => {
              const s = ctx.raw._stat;
              const lines = [
                `Events: ${s.event_count}`,
                `Avg intensity: ${Number(s.mean_intensity ?? 0).toFixed(2)}${unit ? ` ${unit}` : ''}`,
              ];
              if (s.longest_event_days != null) lines.push(`Longest: ${s.longest_event_days} days`);
              if (s.max_temp_recorded != null)  lines.push(`Peak: ${s.max_temp_recorded}${unit ? ` ${unit}` : ''}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            color: AXIS_COLOR,
            font: { size: 10, family: 'Inter' },
            callback: (v) => Number.isInteger(v) ? v : '',
          },
          grid: { color: GRID_COLOR },
          border: { color: 'transparent' },
          title: { display: true, text: 'Year', color: AXIS_COLOR, font: { size: 10 } },
        },
        y: {
          ticks: {
            color: AXIS_COLOR,
            font: { size: 10, family: 'Inter' },
            callback: (v) => unit ? `${v.toFixed(1)}` : v.toFixed(1),
          },
          grid: { color: GRID_COLOR },
          border: { color: 'transparent' },
          title: { display: true, text: yLabel, color: AXIS_COLOR, font: { size: 10 } },
          min: 0,
        },
      },
    };

    return { data: chartData, options: chartOptions };
  }, [yearlyStats, unit]);

  if (!data) {
    return (
      <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
        No event data with intensity values to display.
      </div>
    );
  }

  return (
    <div className="chart-container" style={{ height: '260px' }}>
      <Bubble data={data} options={options} />
    </div>
  );
}
