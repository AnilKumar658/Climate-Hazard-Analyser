# 🌡️ Climate Hazard Trend Analyzer

> A full-stack web application that detects and visualizes historical heatwave trends using ERA5 reanalysis data from Open-Meteo.

---

## 📐 Architecture

```
climate-hazard-analyzer/
├── backend/                   # Python FastAPI backend
│   ├── main.py                # App entry point, CORS, rate limiting
│   ├── config.py              # Pydantic settings (env-based)
│   ├── routers/
│   │   └── weather.py         # API endpoints: /analyze, /regions/search, /export
│   ├── services/
│   │   ├── data_fetcher.py    # Open-Meteo ERA5 fetcher w/ retry + outlier removal
│   │   ├── hazard_detector.py # Heatwave detection algorithm
│   │   ├── trend_analyzer.py  # Linear regression + Mann-Kendall test
│   │   ├── cache_service.py   # MongoDB TTL + diskcache fallback
│   │   └── export_service.py  # CSV and PDF export (ReportLab)
│   ├── models/
│   │   └── schemas.py         # Pydantic request/response models
│   ├── db/
│   │   └── mongodb.py         # Motor async MongoDB client
│   └── requirements.txt
├── src/                       # React + Vite frontend
│   ├── api/client.js          # Axios API client
│   ├── components/
│   │   ├── RegionSelector.jsx # Leaflet map + geocoding city search
│   │   ├── AnalysisControls.jsx # Hazard type + year range controls
│   │   ├── TimeSeriesChart.jsx  # Chart.js bar+line chart
│   │   ├── IntensityChart.jsx   # Bubble chart (intensity vs time)
│   │   ├── DurationHeatmap.jsx  # Calendar-style heatmap grid
│   │   ├── InsightsSummary.jsx  # Auto-generated text insights
│   │   ├── ExportPanel.jsx      # CSV/PDF download buttons
│   │   └── LoadingState.jsx     # Animated loading steps
│   ├── App.jsx                # Main application
│   └── index.css              # Design system (dark theme)
└── index.html
```

**Stack:**
- **Frontend**: React 18 + Vite, Chart.js + react-chartjs-2, Leaflet + react-leaflet
- **Backend**: Python 3.10+, FastAPI, Motor (async MongoDB), slowapi rate limiting
- **Database**: MongoDB Atlas (free tier) with TTL cache collection + diskcache fallback
- **Data Source**: Open-Meteo Historical Weather API (ERA5 reanalysis, free, no API key required)
- **Deployment**: Frontend → Vercel, Backend → Render

---

## 🔬 Heatwave Detection Logic

**Definition**: A heatwave occurs when the daily maximum temperature (tmax) exceeds the **95th percentile** of the historical baseline for **3 or more consecutive days**.

This aligns with WMO guidelines and the ETCCDI Expert Team on Climate Change Detection Indices.

**Algorithm (implemented in `services/hazard_detector.py`):**

1. **Fetch** daily maximum temperature (tmax) from Open-Meteo ERA5 archive for the selected region and time range.
2. **Clean data**: Fill small gaps (≤3 days) via linear interpolation. Remove outliers beyond ±4σ.
3. **Compute threshold**: Calculate the **95th percentile** of all valid tmax values across the full date range.
4. **Mark hot days**: Tag each day where `tmax > threshold`.
5. **Detect runs**: Find consecutive runs of hot-tagged days. If a run is **≥ 3 days long**, it qualifies as a heatwave event.
6. **Aggregate**: Group events by year; count frequency, duration, and intensity (mean °C above threshold).

**Trend Analysis (implemented in `services/trend_analyzer.py`):**

- **Linear Regression** (scipy): Slope, R², and p-value on annual event counts.
- **Mann-Kendall Test** (pymannkendall): Non-parametric monotonic trend test — preferred for climate data.
- **5-Year Rolling Average**: Centered window to smooth year-to-year variability.
- **Percent Change**: First 5-year average vs. last 5-year average.

---

## ⚡ Setup Instructions

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI if you have MongoDB Atlas
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be live at: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/v1/health`

> **No MongoDB?** The app gracefully falls back to `diskcache` (file-based cache).

### Frontend

```bash
# From project root
npm install
npm run dev
```

Frontend will be live at: `http://localhost:5173`

---

## 🌐 Deployment

### Backend (Render)

1. Create a **Web Service** on Render.com
2. Root directory: `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set env variables: `MONGODB_URI`, `CORS_ORIGINS` (your Vercel URL)

### Frontend (Vercel)

1. Push to GitHub
2. Import project on Vercel
3. Set env variable: `VITE_API_URL=https://your-render-service.onrender.com/api/v1`
4. Deploy

---

## 🔒 Security & Performance

| Feature | Implementation |
|---|---|
| Rate Limiting | slowapi: 30 requests/minute per IP |
| Input Validation | Pydantic models with strict bounds (lat ±90, year 1950–2023) |
| Cache | MongoDB TTL (7 days) + diskcache fallback |
| CORS | Configured for specific frontend origins only |
| Retry Logic | 3 retries with exponential backoff on external API calls |
| Timeout | 60s timeout on Open-Meteo requests |
| Outlier Handling | ±4σ filter applied before threshold computation |

---

## 📊 Data Source

**Open-Meteo Historical Weather API** (`archive-api.open-meteo.com/v1/archive`)
- Provides ERA5 reanalysis data from ECMWF
- Free, no API key required
- Global coverage from 1940 to near-present
- Spatial resolution: ~25km
- Variable used: `temperature_2m_max` (°C)

---

## 📌 Assumptions

1. **Baseline period**: The full user-selected date range is used to compute the 95th percentile threshold. A more rigorous approach would use a fixed baseline (e.g., 1981–2010).

2. **Spatial averaging**: The API returns data for a single lat/lon point (nearest grid cell, ~25km), not a true spatial average over a box.

3. **Back-to-back events**: Two consecutive heatwave runs separated by a single non-heatwave day are counted as separate events.

4. **Coordinate rounding**: Coordinates are rounded to 2 decimal places (~1km precision) for better cache hit rates.

5. **Year cap**: End year is capped at 2023 for complete annual records.

6. **Mann-Kendall significance**: Reported at α = 0.05. Statistical power is limited for short time series.

---

## 🚀 What I Would Improve With More Time

1. **Fixed baseline climatology**: Compute p95 over a fixed 1981–2010 baseline regardless of analysis period.
2. **Spatial averaging**: Allow bounding box selection and average over multiple ERA5 grid points.
3. **Additional hazard types**: Drought (SPI), heavy rainfall (R99p), and cold spells.
4. **Bootstrap confidence intervals**: For trend slope uncertainty.
5. **Multi-region comparison**: Side-by-side comparison of two cities.
6. **WebSocket progress updates**: Real-time fetch progress.
7. **IPCC scenario overlays**: Projected future trends under SSP2/SSP5.

---

## 🤖 AI Tools Used

- **Antigravity (Google DeepMind)**: Used as the primary coding assistant to scaffold, generate, and iterate on all backend and frontend code. The AI generated the project structure, heatwave detection algorithm, FastAPI endpoints, Chart.js visualizations, Leaflet map integration, and the CSS design system. Code was reviewed and validated manually throughout.

---

## 📝 License

MIT — Free to use and modify.
