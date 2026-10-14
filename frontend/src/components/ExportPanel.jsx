/**
 * ExportPanel: CSV and PDF export buttons with loading and error states.
 * Supports compact (header) and full (card) modes.
 */
import { useState } from 'react';
import { getCSVExportURL, getPDFExportURL } from '../api/client';

export default function ExportPanel({ analysisParams, regionName, compact = false }) {
  const [downloading, setDownloading] = useState(null);
  const [exportError, setExportError] = useState('');

  const handleExport = async (type) => {
    if (downloading) return;
    setDownloading(type);
    setExportError('');

    try {
      const params = { ...analysisParams, region_name: regionName };
      const url = type === 'csv' ? getCSVExportURL(params) : getPDFExportURL(params);

      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Export failed (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const blobURL = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobURL;
      a.download = `climate_${regionName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${analysisParams.start_year}_${analysisParams.end_year}.${type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobURL);
    } catch (err) {
      console.error('[ExportPanel]', err);
      setExportError(err.message || 'Export failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (compact) {
    return (
      <div className="export-actions">
        <button
          id="export-csv-btn"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleExport('csv')}
          disabled={downloading !== null}
          aria-label="Export data as CSV"
          title="Export CSV"
        >
          {downloading === 'csv' ? (
            <><span className="btn-loader" aria-hidden="true" /> CSV…</>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              CSV
            </>
          )}
        </button>

        <button
          id="export-pdf-btn"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleExport('pdf')}
          disabled={downloading !== null}
          aria-label="Download PDF report"
          title="Download PDF report"
        >
          {downloading === 'pdf' ? (
            <><span className="btn-loader" aria-hidden="true" /> PDF…</>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              PDF
            </>
          )}
        </button>

        {exportError && (
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)' }} role="alert">
            {exportError}
          </span>
        )}
      </div>
    );
  }

  // Full mode (standalone card)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="export-actions">
        <button
          id="export-csv-btn-full"
          type="button"
          className="btn btn-secondary"
          onClick={() => handleExport('csv')}
          disabled={downloading !== null}
        >
          {downloading === 'csv' ? <><span className="btn-loader" aria-hidden="true" /> Exporting…</> : '📊 Export CSV'}
        </button>

        <button
          id="export-pdf-btn-full"
          type="button"
          className="btn btn-secondary"
          onClick={() => handleExport('pdf')}
          disabled={downloading !== null}
        >
          {downloading === 'pdf' ? <><span className="btn-loader" aria-hidden="true" /> Generating…</> : '📄 PDF Report'}
        </button>

        <span style={{
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          padding: '0.2rem 0.6rem',
          background: 'var(--bg-surface-2)',
          borderRadius: 'var(--radius-xs)',
          border: '1px solid var(--border-subtle)',
        }}>
          {analysisParams.start_year}–{analysisParams.end_year} · {regionName}
        </span>
      </div>

      {exportError && (
        <div className="location-error" role="alert">{exportError}</div>
      )}
    </div>
  );
}
