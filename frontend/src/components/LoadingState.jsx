/**
 * LoadingState: Compact animated loading display with hazard-aware step labels.
 */
import { useState, useEffect } from 'react';

const STEPS = [
  'Fetching ERA5 historical weather data…',
  'Cleaning and normalizing data…',
  'Computing detection threshold…',
  'Detecting hazard events…',
  'Running trend analysis (Mann–Kendall)…',
  'Generating insights…',
];

export default function LoadingState({ hazard = 'heatwave', displayHazard }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setCurrentStep(i + 1), i * 4200)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const hazardName = displayHazard?.title || 'Hazard';

  return (
    <div className="loading-compact" role="status" aria-live="polite" aria-label="Analyzing climate data">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div className="loading-spinner-sm" aria-hidden="true" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Space Grotesk, system-ui', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Analyzing {hazardName} Data
        </div>

        <div className="loading-steps-list">
          {STEPS.map((text, i) => {
            const isDone = i < currentStep - 1;
            const isActive = i === currentStep - 1;
            return (
              <div
                key={i}
                className={`loading-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
              >
                <div className="loading-step__dot" aria-hidden="true" />
                <span>{text}</span>
              </div>
            );
          })}
        </div>

        <p style={{ marginTop: '0.625rem', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          First-time queries may take 30–60 s. Results are cached for 7 days.
        </p>
      </div>
    </div>
  );
}
