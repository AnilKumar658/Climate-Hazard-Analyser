/**
 * AnalysisControls: Hazard type selector, date range sliders, and analyze button.
 */
import { useState } from 'react';

const HAZARD_OPTIONS = [
  {
    value: 'heatwave',
    emoji: '🌡️',
    label: 'Heatwave',
    description: '3+ days above the 95th percentile max temp',
  },
  {
    value: 'cold_wave',
    emoji: '❄️',
    label: 'Cold Wave',
    description: 'Unusually low minimum temperatures',
  },
  {
    value: 'heavy_rainfall',
    emoji: '🌧️',
    label: 'Heavy Rainfall',
    description: 'Daily precipitation above extreme threshold',
  },
  {
    value: 'drought',
    emoji: '🌵',
    label: 'Drought',
    description: 'Prolonged precipitation deficit indicator',
  },
  {
    value: 'flood',
    emoji: '🌊',
    label: 'Flood Risk',
    description: 'Extreme rainfall-based flood proxy',
  },
  {
    value: 'strong_winds',
    emoji: '💨',
    label: 'Strong Winds',
    description: 'Max wind speed above extreme threshold',
  },
  {
    value: 'wildfire',
    emoji: '🔥',
    label: 'Wildfire Weather',
    description: 'Hot, dry and windy fire-weather indicator',
  },
  {
    value: 'thunderstorm',
    emoji: '⛈️',
    label: 'Thunderstorm',
    description: 'Atmospheric conditions favorable for storms',
  },
  {
    value: 'extreme_precipitation',
    emoji: '🌦️',
    label: 'Extreme Precip.',
    description: 'Unusually intense daily precipitation',
  },
  {
    value: 'frost',
    emoji: '🧊',
    label: 'Frost',
    description: 'Min temperature below freezing threshold',
  },
];

const MIN_YEAR = 1950;
const MAX_YEAR = 2024;

export default function AnalysisControls({
  startYear,
  endYear,
  hazard,
  onStartYearChange,
  onEndYearChange,
  onHazardChange,
  onAnalyze,
  isLoading,
  hasRegion,
}) {
  const [localError, setLocalError] = useState('');

  const handleAnalyze = () => {
    setLocalError('');
    if (!hasRegion) {
      setLocalError('Select a region on the map first.');
      return;
    }
    if (endYear - startYear < 4) {
      setLocalError('Select at least a 5-year range.');
      return;
    }
    onAnalyze();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Hazard Type */}
      <div className="form-group">
        <span className="form-label" id="hazard-group-label">Hazard Type</span>
        <div
          className="hazard-grid"
          role="group"
          aria-labelledby="hazard-group-label"
        >
          {HAZARD_OPTIONS.map((opt) => {
            const isActive = hazard === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`hazard-btn${isActive ? ' hazard-btn--active' : ''}`}
                onClick={() => onHazardChange(opt.value)}
                aria-pressed={isActive}
                title={opt.description}
              >
                <span className="hazard-btn__emoji" aria-hidden="true">{opt.emoji}</span>
                <span className="hazard-btn__label">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Range */}
      <div className="form-group">
        <span className="form-label" id="time-range-label">Time Range</span>
        <div className="year-range-box" aria-labelledby="time-range-label">
          {/* Start Year */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label htmlFor="start-year-slider" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                From
              </label>
              <span className="range-value" aria-label={`Start year: ${startYear}`}>{startYear}</span>
            </div>
            <input
              id="start-year-slider"
              type="range"
              min={MIN_YEAR}
              max={MAX_YEAR - 1}
              value={startYear}
              aria-valuemin={MIN_YEAR}
              aria-valuemax={MAX_YEAR - 1}
              aria-valuenow={startYear}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onStartYearChange(Math.min(val, endYear - 4));
              }}
            />
          </div>

          {/* End Year */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <label htmlFor="end-year-slider" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                To
              </label>
              <span className="range-value" aria-label={`End year: ${endYear}`}>{endYear}</span>
            </div>
            <input
              id="end-year-slider"
              type="range"
              min={MIN_YEAR + 1}
              max={MAX_YEAR}
              value={endYear}
              aria-valuemin={MIN_YEAR + 1}
              aria-valuemax={MAX_YEAR}
              aria-valuenow={endYear}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onEndYearChange(Math.max(val, startYear + 4));
              }}
            />
          </div>

          <div className="year-range-summary" aria-live="polite">
            📅 {endYear - startYear + 1} years · {startYear}–{endYear}
          </div>
        </div>
      </div>

      {/* Validation error */}
      {localError && (
        <div
          className="location-error"
          role="alert"
          aria-live="assertive"
        >
          ⚠ {localError}
        </div>
      )}

      {/* Analyze button */}
      <div className="analyze-area">
        <button
          id="analyze-btn"
          type="button"
          className="btn btn-primary btn-full btn-lg"
          onClick={handleAnalyze}
          disabled={isLoading || !hasRegion}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="btn-loader" aria-hidden="true" />
              Analyzing…
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Analyze Hazards
            </>
          )}
        </button>

        {!hasRegion && !isLoading && (
          <p className="analyze-hint" aria-live="polite">
            ↑ Select a location to enable analysis
          </p>
        )}
      </div>
    </div>
  );
}
