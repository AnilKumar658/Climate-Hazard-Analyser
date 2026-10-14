/**
 * TimeSeriesChart: Annual hazard events + 5-year rolling average + linear trend.
 * Labels use the hazard-specific event label from displayHazard.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  BarController,
  LineController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useMemo } from 'react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  BarController, LineController,
  Title, ChartTooltip, Legend, Filler,
);

const PRIMARY_BLUE = '#0284C7';
const SKY_LINE     = '#38BDF8';
const SLATE_TREND  = '#94A3B8';
const GRID_COLOR   = 'rgba(255,255,255,0.04)';
const AXIS_COLOR   = '#64748B';

export default function TimeSeriesChart({ yearlyStats, rollingAvg, trend, eventLabel = 'Hazard Events' }) {
  const { data, options } = useMemo(() => {
    if (!yearlyStats?.length) return { data: null, options: null };

    const labels    = yearlyStats.map((s) => s.year.toString());
    const counts    = yearlyStats.map((s) => Number(s.event_count || 0));
    const rolling   = (rollingAvg ?? []).map((r) => Number(r.avg_events ?? 0));
    const regression = (rollingAvg ?? []).map((r) => Math.max(0, Number(r.regression_fit ?? 0)));
    const maxCount  = Math.max(...counts, 1);

    const chartData = {
      labels,
      datasets: [
        {
          type: 'bar',
          label: eventLabel,
          data: counts,
          backgroundColor: counts.map((c) => {
            const alpha = 0.3 + 0.6 * (c / maxCount);
            return `rgba(14, 165, 233, ${alpha.toFixed(2)})`;
          }),
          borderColor: PRIMARY_BLUE,
          borderWidth: 1,
          borderRadius: 2,
          order: 3,
        },
        ...(rolling.length ? [{
          type: 'line',
          label: '5-Year Rolling Avg',
          data: rolling,
          borderColor: SKY_LINE,
          backgroundColor: 'rgba(56, 189, 248, 0.05)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
          order: 2,
        }] : []),
        ...(regression.length ? [{
          type: 'line',
          label: 'Linear Trend',
          data: regression,
          borderColor: SLATE_TREND,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0,
          fill: false,
          order: 1,
        }] : []),
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: false, // We render our own legend above the chart
        },
        tooltip: {
          backgroundColor: 'rgba(11,16,32,0.97)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#F1F5F9',
          bodyColor: '#94A3B8',
          padding: 10,
          callbacks: {
            afterBody(ctx) {
              const year = parseInt(ctx[0].label, 10);
              const stat = yearlyStats.find((s) => s.year === year);
              if (!stat) return [];
              const lines = [];
              if (stat.total_duration_days != null) lines.push(`Days: ${stat.total_duration_days}`);
              if (stat.longest_event_days != null)  lines.push(`Longest: ${stat.longest_event_days} days`);
              if (stat.mean_intensity > 0)           lines.push(`Avg intensity: ${stat.mean_intensity.toFixed(1)}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: AXIS_COLOR, font: { size: 10, family: 'Inter' }, maxTicksLimit: 15 },
          grid: { color: GRID_COLOR },
          border: { color: 'transparent' },
        },
        y: {
          ticks: {
            color: AXIS_COLOR,
            font: { size: 10, family: 'Inter' },
            stepSize: 1,
            callback: (v) => (Number.isInteger(v) ? v : ''),
          },
          grid: { color: GRID_COLOR },
          border: { color: 'transparent' },
          title: {
            display: true,
            text: 'Events',
            color: AXIS_COLOR,
            font: { size: 10, family: 'Inter' },
          },
          min: 0,
        },
      },
    };

    return { data: chartData, options: chartOptions };
  }, [yearlyStats, rollingAvg, trend, eventLabel]);

  if (!data) {
    return (
      <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No yearly data available.
      </div>
    );
  }

  return (
    <div className="chart-container" style={{ height: '280px' }}>
      <Chart type="bar" data={data} options={options} />
    </div>
  );
}
