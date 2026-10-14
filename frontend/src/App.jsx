import { useCallback, useMemo, useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';

import RegionSelector from './components/RegionSelector';
import AnalysisControls from './components/AnalysisControls';
import TimeSeriesChart from './components/TimeSeriesChart';
import IntensityChart from './components/IntensityChart';
import DurationHeatmap from './components/DurationHeatmap';
import InsightsSummary from './components/InsightsSummary';
import ExportPanel from './components/ExportPanel';
import LoadingState from './components/LoadingState';
import { analyzeHazard } from './api/client';

/* ── Hazard metadata ────────────────────────────────────────────────────────── */
const HAZARD_DISPLAY = {
  heatwave: {
    emoji: '🌡️',
    title: 'Heatwave',
    eventLabel: 'Heatwave Events',
    durationLabel: 'Heatwave Days',
    averageLabel: 'Avg Events / Year',
    thresholdLabel: '95th Percentile Threshold',
    unit: '°C',
    intensityDescription: 'Event intensity is based on detected high-temperature values above the threshold.',
    heatmapDescription: 'Each cell shows detected heatwave days for that year.',
    definition: 'Heatwave detection uses consecutive days above a location-specific high-temperature threshold.',
  },
  cold_wave: {
    emoji: '❄️',
    title: 'Cold Wave',
    eventLabel: 'Cold-Wave Events',
    durationLabel: 'Cold-Wave Days',
    averageLabel: 'Avg Cold-Wave Events / Year',
    thresholdLabel: 'Cold-Wave Threshold',
    unit: '°C',
    intensityDescription: 'Event intensity is based on detected low-temperature values.',
    heatmapDescription: 'Each cell shows detected cold-wave days for that year.',
    definition: 'Cold-wave detection uses consecutive days below a location-specific low-temperature threshold.',
  },
  heavy_rainfall: {
    emoji: '🌧️',
    title: 'Heavy Rainfall',
    eventLabel: 'Heavy-Rainfall Events',
    durationLabel: 'Heavy-Rainfall Days',
    averageLabel: 'Avg Heavy-Rainfall Events / Year',
    thresholdLabel: 'Rainfall Threshold',
    unit: 'mm/day',
    intensityDescription: 'Intensity is based on daily precipitation.',
    heatmapDescription: 'Each cell shows detected heavy-rainfall days for that year.',
    definition: 'Heavy-rainfall events are identified from daily precipitation thresholds.',
  },
  extreme_precipitation: {
    emoji: '🌦️',
    title: 'Extreme Precipitation',
    eventLabel: 'Extreme-Precipitation Events',
    durationLabel: 'Extreme-Precipitation Days',
    averageLabel: 'Avg Extreme Events / Year',
    thresholdLabel: 'Extreme-Precipitation Threshold',
    unit: 'mm/day',
    intensityDescription: 'Intensity is based on daily precipitation.',
    heatmapDescription: 'Each cell shows detected extreme-precipitation days for that year.',
    definition: 'Extreme precipitation is identified from unusually high daily precipitation.',
  },
  drought: {
    emoji: '🌵',
    title: 'Drought Indicator',
    eventLabel: 'Drought-Indicator Events',
    durationLabel: 'Drought-Indicator Days',
    averageLabel: 'Avg Drought Indicators / Year',
    thresholdLabel: 'Rolling Precipitation Threshold',
    unit: 'mm/90 days',
    intensityDescription: 'This indicator uses rolling precipitation totals; it is not a complete drought-impact assessment.',
    heatmapDescription: 'Each cell shows days flagged by the precipitation-deficit indicator.',
    definition: 'Drought is represented by a precipitation-deficit indicator and should not be interpreted as a full drought assessment.',
  },
  flood: {
    emoji: '🌊',
    title: 'Potential Flood Conditions',
    eventLabel: 'Potential Flood Events',
    durationLabel: 'Potential Flood Days',
    averageLabel: 'Avg Potential Flood Events / Year',
    thresholdLabel: 'Heavy-Rainfall Proxy Threshold',
    unit: 'mm/day',
    intensityDescription: 'This is a rainfall-based flood proxy, not a record of confirmed floods or flood severity.',
    heatmapDescription: 'Each cell shows days identified by the potential-flood rainfall proxy.',
    definition: 'Flood conditions are approximated using rainfall; local hydrology and observed flood records are not included.',
  },
  strong_winds: {
    emoji: '💨',
    title: 'Strong Winds',
    eventLabel: 'Strong-Wind Events',
    durationLabel: 'Strong-Wind Days',
    averageLabel: 'Avg Strong-Wind Events / Year',
    thresholdLabel: 'Wind-Speed / Gust Threshold',
    unit: 'km/h',
    intensityDescription: 'Intensity is based on the available daily maximum wind-speed or gust values.',
    heatmapDescription: 'Each cell shows detected strong-wind days for that year.',
    definition: 'Strong-wind events are identified from daily maximum wind-speed or gust thresholds.',
  },
  wildfire: {
    emoji: '🔥',
    title: 'Wildfire Weather Risk',
    eventLabel: 'Fire-Weather Events',
    durationLabel: 'Fire-Weather Days',
    averageLabel: 'Avg Fire-Weather Events / Year',
    thresholdLabel: 'Fire-Weather Indicator Threshold',
    unit: '°C / km/h',
    intensityDescription: 'This is a hot, dry and windy weather indicator—not a record or prediction of actual wildfires.',
    heatmapDescription: 'Each cell shows days matching the fire-weather indicator.',
    definition: 'Wildfire weather is represented by a weather-risk proxy and does not confirm wildfire occurrence.',
  },
  thunderstorm: {
    emoji: '⛈️',
    title: 'Thunderstorm',
    eventLabel: 'Thunderstorm Events',
    durationLabel: 'Thunderstorm Days',
    averageLabel: 'Avg Thunderstorm Events / Year',
    thresholdLabel: 'Detection Threshold',
    unit: '',
    intensityDescription: 'Thunderstorm detection requires suitable storm observations or atmospheric data.',
    heatmapDescription: 'Thunderstorm duration is available only when the backend detector supports it.',
    definition: 'Thunderstorm detection may be unavailable if the backend does not have suitable observations.',
  },
  frost: {
    emoji: '🧊',
    title: 'Frost',
    eventLabel: 'Frost Events',
    durationLabel: 'Frost Days',
    averageLabel: 'Avg Frost Events / Year',
    thresholdLabel: 'Freezing Threshold',
    unit: '°C',
    intensityDescription: 'Frost detection is based on daily minimum air temperature.',
    heatmapDescription: 'Each cell shows detected frost days for that year.',
    definition: 'Frost days are identified from daily minimum temperature.',
  },
};

const EMPTY_QUALITY = {
  coverage_pct: 0,
  total_days: 0,
  originally_missing_days: 0,
  interpolated_days: 0,
  outlier_days_removed: 0,
};

/* ── App ──────────────────────────────────────────────────────────────────────── */
export default function App() {
  // Region state
  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLon, setSelectedLon] = useState(null);
  const [regionName, setRegionName] = useState('');

  // Analysis controls
  const [startYear, setStartYear] = useState(1990);
  const [endYear, setEndYear] = useState(2023);
  const [hazard, setHazard] = useState('heatwave');

  // Results and UI state
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('timeseries');

  // Sidebar open/close (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on wide screens
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close sidebar on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const displayHazard = HAZARD_DISPLAY[(results?.hazard) || hazard] ?? HAZARD_DISPLAY.heatwave;
  const hasRegion = selectedLat !== null && selectedLon !== null;

  /* ── Derived data quality ─────────────────────────────────────────────────── */
  const quality = useMemo(() => {
    const q = results?.data_quality;
    if (!q) return EMPTY_QUALITY;
    const missingByVariable = q.missing_by_variable ?? {};
    const missingFromVariables = Object.values(missingByVariable).reduce(
      (sum, value) => sum + Number(value || 0), 0
    );
    return {
      coverage_pct: Number(q.coverage_pct ?? q.coverage_percent ?? 0),
      total_days: Number(q.total_days ?? q.days_returned ?? 0),
      originally_missing_days: Number(q.originally_missing_days ?? missingFromVariables),
      interpolated_days: Number(q.interpolated_days ?? 0),
      outlier_days_removed: Number(q.outlier_days_removed ?? 0),
    };
  }, [results]);

  /* ── Derived stats ────────────────────────────────────────────────────────── */
  const yearlyStats = results?.yearly_stats ?? [];
  const totalEvents = yearlyStats.reduce((sum, y) => sum + Number(y.event_count || 0), 0);
  const totalHazardDays = yearlyStats.reduce((sum, y) => sum + Number(y.total_duration_days || 0), 0);
  const peakYear = yearlyStats.length
    ? yearlyStats.reduce((best, y) => y.event_count > best.event_count ? y : best, yearlyStats[0])
    : null;
  const yearsAnalyzed = results
    ? Math.max(1, results.end_year - results.start_year + 1)
    : Math.max(1, endYear - startYear + 1);
  const avgPerYear = results ? (totalEvents / yearsAnalyzed).toFixed(1) : '0.0';
  const trendPercent = Number(results?.trend?.percent_change ?? 0);
  const thresholdValue = results?.threshold_temp;
  const thresholdUnit = results?.threshold_unit ?? displayHazard.unit;
  const coverage = Math.min(100, Math.max(0, quality.coverage_pct));

  /* ── Handlers ─────────────────────────────────────────────────────────────── */
  const handleRegionSelect = useCallback((lat, lon, name) => {
    setSelectedLat(lat);
    setSelectedLon(lon);
    setRegionName(name);
    setResults(null);
    setError('');
    setSidebarOpen(false);
  }, []);

  const handleHazardChange = useCallback((nextHazard) => {
    setHazard(nextHazard);
    setResults(null);
    setError('');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (selectedLat === null || selectedLon === null) {
      setError('Please select a region on the map before analyzing.');
      return;
    }
    if (startYear > endYear) {
      setError('Start year must be before end year.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults(null);
    setSidebarOpen(false);

    const toastId = toast.loading('Fetching climate data…', {
      style: { background: '#141D30', color: '#F1F5F9', border: '1px solid #29364A' },
    });

    try {
      const data = await analyzeHazard({
        lat: selectedLat,
        lon: selectedLon,
        start_year: startYear,
        end_year: endYear,
        hazard,
        region_name: regionName,
      });
      setResults(data);
      const eventCount = data.yearly_stats?.reduce(
        (sum, y) => sum + Number(y.event_count || 0), 0
      ) ?? 0;
      toast.success(
        data.cached ? '⚡ Loaded from cache' : `✅ Analysis complete — ${eventCount} events detected`,
        {
          id: toastId,
          duration: 4000,
          style: { background: '#141D30', color: '#F1F5F9', border: '1px solid rgba(52,211,153,0.3)' },
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setError(message);
      toast.error(message, {
        id: toastId,
        style: { background: '#141D30', color: '#F1F5F9', border: '1px solid rgba(248,113,113,0.3)' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedLat, selectedLon, regionName, startYear, endYear, hazard]);

  /* ── Analysis params for export ───────────────────────────────────────────── */
  const analysisParams = {
    lat: selectedLat,
    lon: selectedLon,
    start_year: startYear,
    end_year: endYear,
    hazard,
  };

  /* ── Trend direction ──────────────────────────────────────────────────────── */
  const trendDir = results?.trend?.trend_direction || results?.trend?.mann_kendall_trend || 'no trend';
  const trendClass = trendDir === 'increasing' ? 'up' : trendDir === 'decreasing' ? 'down' : 'flat';
  const trendLabel = trendDir === 'increasing' ? '↑ Increasing' : trendDir === 'decreasing' ? '↓ Decreasing' : '→ No trend';

  /* ── Severity ─────────────────────────────────────────────────────────────── */
  const severity = results?.insights?.severity || 'low';
  const severityBadgeClass = severity === 'severe' ? 'red' : severity === 'high' ? 'orange' : severity === 'moderate' ? 'yellow' : 'green';
  const severityLabel = { low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk', severe: 'Severe Risk' }[severity] ?? 'Low Risk';

  /* ── Threshold display ────────────────────────────────────────────────────── */
  const thresholdDisplay = thresholdValue == null || !Number.isFinite(Number(thresholdValue))
    ? 'N/A'
    : `${Number(thresholdValue).toFixed(1)}${thresholdUnit ? ` ${thresholdUnit}` : ''}`;

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.85rem' },
        }}
      />

      <div className="app-layout">
        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <header className="app-header" role="banner">
          {/* Hamburger (mobile) */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Close analysis panel' : 'Open analysis panel'}
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
          >
            {sidebarOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>

          {/* Brand */}
          <div className="header-brand">
            <div className="header-logo" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
              </svg>
            </div>
            <div>
              <div className="header-title">Climate Hazard Analyzer</div>
              <div className="header-subtitle">ERA5 Reanalysis · Open-Meteo</div>
            </div>
          </div>

          {/* Context: selected location */}
          <div className="header-context">
            {hasRegion && regionName && (
              <div className="header-location-pill" title={regionName} aria-label={`Selected location: ${regionName}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{regionName}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="header-actions">
            {results && (
              <ExportPanel
                analysisParams={analysisParams}
                regionName={regionName}
                compact
              />
            )}
            <div className="header-status-badge">
              <div className="header-status-dot" aria-hidden="true" />
              Live Data
            </div>
          </div>
        </header>

        {/* ── BODY ───────────────────────────────────────────────────────────── */}
        <div className="dashboard-body">
          {/* Overlay (mobile) */}
          <div
            className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

          {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
          <aside
            id="sidebar"
            className={`sidebar${sidebarOpen ? ' open' : ''}`}
            aria-label="Analysis configuration"
          >
            <div className="sidebar-inner">
              {/* Select Region */}
              <div>
                <div className="sidebar-section-title">Select Location</div>
                <div className="card card-sm">
                  <RegionSelector
                    selectedLat={selectedLat}
                    selectedLon={selectedLon}
                    regionName={regionName}
                    onSelect={handleRegionSelect}
                  />
                </div>
              </div>

              {/* Analysis Controls */}
              <div>
                <div className="sidebar-section-title">Analysis Parameters</div>
                <div className="card card-sm">
                  <AnalysisControls
                    startYear={startYear}
                    endYear={endYear}
                    hazard={hazard}
                    onStartYearChange={setStartYear}
                    onEndYearChange={setEndYear}
                    onHazardChange={handleHazardChange}
                    onAnalyze={handleAnalyze}
                    isLoading={isLoading}
                    hasRegion={hasRegion}
                  />
                </div>
              </div>

              {/* Data Quality (sidebar) */}
              {results && (
                <div className="fade-in">
                  <div className="sidebar-section-title">Data Quality</div>
                  <div className="card card-sm">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Coverage</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: coverage > 95 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                            {coverage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="quality-bar-track">
                          <div
                            className="quality-bar-fill"
                            role="progressbar"
                            aria-valuenow={coverage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{
                              width: `${coverage}%`,
                              background: coverage > 95
                                ? 'linear-gradient(90deg, var(--accent-green), #6ee7b7)'
                                : 'linear-gradient(90deg, var(--accent-yellow), var(--accent-primary))',
                            }}
                          />
                        </div>
                      </div>

                      <div className="quality-mini-grid">
                        {[
                          ['Days', quality.total_days.toLocaleString()],
                          ['Missing', quality.originally_missing_days.toLocaleString()],
                          ['Interpolated', quality.interpolated_days.toLocaleString()],
                          ['Outliers', quality.outlier_days_removed.toLocaleString()],
                        ].map(([label, value]) => (
                          <div key={label} className="quality-mini-cell">
                            <div className="quality-mini-cell__label">{label}</div>
                            <div className="quality-mini-cell__value">{value}</div>
                          </div>
                        ))}
                      </div>

                      {results.cached && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          ⚡ Served from cache (7-day TTL)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ── MAIN PANEL ───────────────────────────────────────────────────── */}
          <main className="main-panel" role="main">
            <div className="main-panel-inner">

              {/* Page title + description */}
              <div className="page-title-bar">
                <div>
                  <h1 className="page-title">
                    {results
                      ? `${displayHazard.title} Analysis — ${results.region_name}`
                      : 'Climate Hazard Intelligence'}
                  </h1>
                  <p className="page-subtitle">
                    {results
                      ? `${results.start_year}–${results.end_year} · ${results.lat.toFixed(4)}°, ${results.lon.toFixed(4)}° · ERA5 Reanalysis`
                      : 'Select a region and configure the analysis to explore historical climate hazard trends.'}
                  </p>
                </div>
              </div>

              {/* ── Loading ───────────────────────────────────────────────────── */}
              {isLoading && (
                <div className="card">
                  <LoadingState hazard={hazard} displayHazard={displayHazard} />
                </div>
              )}

              {/* ── Error ─────────────────────────────────────────────────────── */}
              {error && !isLoading && (
                <div className="error-panel" role="alert">
                  <div className="error-panel__icon">⚠️</div>
                  <div>
                    <div className="error-panel__title">Analysis Failed</div>
                    <div className="error-panel__message">{error}</div>
                    {hasRegion && (
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ marginTop: '0.75rem' }}
                        onClick={handleAnalyze}
                      >
                        Retry Analysis
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Empty state ───────────────────────────────────────────────── */}
              {!results && !isLoading && !error && (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-state__icon">🌍</div>
                    <h2 className="empty-state__title">Ready to Analyze</h2>
                    <p className="empty-state__desc">
                      Select a region on the map, configure the hazard and time range,
                      then click <strong>Analyze Hazards</strong> to explore{' '}
                      {displayHazard.title.toLowerCase()} trends using ERA5 climate data.
                    </p>
                    <div className="suggestion-chips" aria-label="Example locations">
                      {['Mumbai, India', 'Paris, France', 'Phoenix, USA', 'Madrid, Spain'].map((city) => (
                        <span key={city} className="suggestion-chip">{city}</span>
                      ))}
                    </div>
                    {!hasRegion && (
                      <button
                        className="btn btn-primary btn-lg"
                        style={{ marginTop: '0.75rem' }}
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open analysis panel to select location"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Select a Location
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── RESULTS ───────────────────────────────────────────────────── */}
              {results && !isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="fade-in">

                  {/* Risk Summary Banner */}
                  <div className={`results-banner ${severity}`} role="region" aria-label="Risk summary">
                    <div className="results-banner__icon" aria-hidden="true">
                      {severity === 'severe' ? '🚨' : severity === 'high' ? '🔥' : severity === 'moderate' ? '⚠️' : '✅'}
                    </div>
                    <div className="results-banner__body">
                      <div className="results-banner__badges">
                        <span className={`badge badge-${severityBadgeClass}`}>{severityLabel}</span>
                        <span className={`trend-chip ${trendClass}`}>{trendLabel}</span>
                        {results.cached && <span className="badge badge-blue">⚡ Cached</span>}
                      </div>
                      {results.insights?.headline && (
                        <div className="results-banner__headline">{results.insights.headline}</div>
                      )}
                      {results.insights?.details?.length > 0 && (
                        <ul className="results-banner__details">
                          {results.insights.details.slice(0, 3).map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <section aria-label="Key metrics">
                    <div className="kpi-grid">
                      <div className="kpi-card">
                        <div className="kpi-value">{totalEvents.toLocaleString()}</div>
                        <div className="kpi-label">{displayHazard.eventLabel}</div>
                        <div className={`kpi-sub ${trendPercent > 10 ? 'up' : trendPercent < -10 ? 'down' : 'neutral'}`}>
                          {trendPercent > 0 ? '▲' : trendPercent < 0 ? '▼' : '→'} {Math.abs(trendPercent).toFixed(1)}% vs early period
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-value">{avgPerYear}</div>
                        <div className="kpi-label">{displayHazard.averageLabel}</div>
                        <div className="kpi-sub neutral">per year avg</div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-value">{totalHazardDays.toLocaleString()}</div>
                        <div className="kpi-label">{displayHazard.durationLabel}</div>
                        <div className="kpi-sub neutral">{yearsAnalyzed} years</div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-value" style={{ fontSize: thresholdDisplay.length > 8 ? '1.3rem' : undefined }}>
                          {thresholdDisplay}
                        </div>
                        <div className="kpi-label">{results.threshold_label || displayHazard.thresholdLabel}</div>
                        <div className="kpi-sub neutral">detection threshold</div>
                      </div>

                      {peakYear && peakYear.event_count > 0 && (
                        <div className="kpi-card">
                          <div className="kpi-value">{peakYear.year}</div>
                          <div className="kpi-label">Peak Year</div>
                          <div className="kpi-sub neutral">{peakYear.event_count} events</div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Charts — Immediately visible above the fold */}
                  <div className="card" role="region" aria-label="Data visualizations">
                    <div className="card-header">
                      <div className="card-title">
                        <div className="card-title-icon" aria-hidden="true">📈</div>
                        Visualizations
                      </div>
                    </div>

                    <div className="tab-bar" role="tablist" aria-label="Visualization tabs">
                      {[
                        { id: 'timeseries', icon: '📈', label: 'Time Series' },
                        { id: 'intensity', icon: '🔥', label: 'Intensity' },
                        { id: 'heatmap', icon: '🗓', label: 'Duration Map' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          aria-controls={`tab-panel-${tab.id}`}
                          id={`tab-${tab.id}`}
                          className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                          onClick={() => setActiveTab(tab.id)}
                        >
                          {tab.icon} {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Time Series */}
                    {activeTab === 'timeseries' && (
                      <div id="tab-panel-timeseries" role="tabpanel" aria-labelledby="tab-timeseries">
                        <div className="chart-legend" style={{ marginBottom: '0.75rem' }}>
                          <div className="legend-item">
                            <div className="legend-dot" style={{ background: '#0284C7' }} />
                            Annual Events
                          </div>
                          <div className="legend-item">
                            <div className="legend-line" style={{ background: '#38BDF8' }} />
                            5-Year Rolling Avg
                          </div>
                          <div className="legend-item">
                            <div className="legend-line" style={{ background: '#94A3B8' }} />
                            Linear Trend
                          </div>
                        </div>
                        <TimeSeriesChart
                          yearlyStats={results.yearly_stats}
                          rollingAvg={results.rolling_avg_5yr}
                          trend={results.trend}
                          eventLabel={displayHazard.eventLabel}
                        />
                      </div>
                    )}

                    {/* Intensity */}
                    {activeTab === 'intensity' && (
                      <div id="tab-panel-intensity" role="tabpanel" aria-labelledby="tab-intensity">
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                          {displayHazard.intensityDescription}
                          {' '}Bubble size reflects longest event duration.
                        </p>
                        <IntensityChart
                          yearlyStats={results.yearly_stats}
                          displayHazard={displayHazard}
                        />
                      </div>
                    )}

                    {/* Duration Heatmap */}
                    {activeTab === 'heatmap' && (
                      <div id="tab-panel-heatmap" role="tabpanel" aria-labelledby="tab-heatmap">
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                          {displayHazard.heatmapDescription}
                        </p>
                        <DurationHeatmap
                          yearlyStats={results.yearly_stats}
                          displayHazard={displayHazard}
                        />
                      </div>
                    )}
                  </div>

                  {/* Insights — Statistical Diagnostics */}
                  <div className="card" role="region" aria-label="Statistical analysis">
                    <div className="card-header">
                      <div className="card-title">
                        <div className="card-title-icon" aria-hidden="true">📊</div>
                        Statistical Diagnostics
                      </div>
                    </div>
                    <InsightsSummary
                      insights={results.insights}
                      trend={results.trend}
                      regionName={results.region_name}
                      threshold={results.threshold_temp}
                      displayHazard={displayHazard}
                    />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: 1.5 }}>
                      {displayHazard.definition}
                    </p>
                  </div>

                  {/* Methodology & Data Source (collapsible) */}
                  <DataMethodologyPanel
                    displayHazard={displayHazard}
                    results={results}
                    startYear={startYear}
                    endYear={endYear}
                  />

                </div>
              )}
            </div>

            {/* Footer */}
            <footer className="app-footer" role="contentinfo">
              <span>
                Data:{' '}
                <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
                  Open-Meteo ERA5 Archive
                </a>
                {' · '}ERA5 Reanalysis · Statistical methods: Linear regression, Mann–Kendall
              </span>
              <span>Climate Hazard Analyzer · Dygnify Ventures</span>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}

/* ── Data Methodology Panel (collapsible) ─────────────────────────────────────── */
function DataMethodologyPanel({ displayHazard, results, startYear, endYear }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card" role="region" aria-label="Data quality and methodology">
      <button
        className="collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="methodology-body"
      >
        <div className="card-title" style={{ margin: 0 }}>
          <div className="card-title-icon" aria-hidden="true">🔬</div>
          Data Quality & Methodology
        </div>
        <svg
          className={`collapsible-icon${open ? ' open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div id="methodology-body" className="collapsible-body">
          <div className="divider" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Data Source</div>
              <div>ERA5 reanalysis via Open-Meteo Historical Weather API. Covers 1940–present with global coverage.</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Analysis Period</div>
              <div>{results?.start_year ?? startYear}–{results?.end_year ?? endYear} · {(results?.end_year ?? endYear) - (results?.start_year ?? startYear) + 1} years</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Detection Method</div>
              <div>{displayHazard.definition}</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Statistical Methods</div>
              <div>Linear regression (OLS), Mann–Kendall non-parametric trend test, 5-year rolling average.</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Threshold</div>
              <div>
                {results?.threshold_label || displayHazard.thresholdLabel}:{' '}
                {results?.threshold_temp != null && Number.isFinite(Number(results.threshold_temp))
                  ? `${Number(results.threshold_temp).toFixed(2)} ${results.threshold_unit ?? displayHazard.unit}`
                  : 'Computed from historical baseline'}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Caveats</div>
              <div>Historical analysis only. Does not constitute future climate projection or policy advice.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
