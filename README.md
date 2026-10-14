# 🌡️ Climate Hazard Trend Analyzer

A high-performance full-stack web application designed to detect, analyze, and visualize multi-decadal historical climate hazards using high-resolution ERA5 reanalysis data from Open-Meteo. The platform identifies extreme weather events, calculates monotonic and linear trends, evaluates statistical significance, and generates downloadable reports.

---

## 📑 Table of Contents

1. [System Architecture](#-system-architecture)
2. [Data Source(s)](#-data-sources)
3. [Hazard Detection & Statistical Logic](#-hazard-detection--statistical-logic)
4. [Assumptions & Methodological Constraints](#-assumptions--methodological-constraints)
5. [Setup & Installation](#-setup--installation)
6. [Deployment Guide](#-deployment-guide)
7. [What Would Be Improved With More Time](#-what-would-be-improved-with-more-time)
8. [AI Tools Used & Methodology](#-ai-tools-used--methodology)
9. [License](#-license)

---

## 📐 System Architecture

### Directory Structure

```
climate-hazard-analyzer/
├── backend/                           # Python FastAPI Backend
│   ├── main.py                        # Application lifecycle, CORS, rate limiting
│   ├── config.py                      # Pydantic v2 environment settings
│   ├── routers/
│   │   └── weather.py                 # API endpoints (/analyze, /regions/search, /export, /health)
│   ├── services/
│   │   ├── data_fetcher.py            # Open-Meteo ERA5 API client w/ retries & geocoding
│   │   ├── hazard_detector.py         # Multi-hazard detection algorithms & yearly aggregations
│   │   ├── trend_analyzer.py          # OLS regression, Mann-Kendall test, rolling averages
│   │   ├── cache_service.py           # Hybrid cache: MongoDB TTL + diskcache fallback
│   │   └── export_service.py          # CSV & PDF report generator (ReportLab)
│   ├── models/
│   │   └── schemas.py                 # Pydantic schemas, validation, HazardType enums
│   ├── db/
│   │   └── mongodb.py                 # Motor async MongoDB client & lifecycle
│   └── requirements.txt               # Backend Python dependencies
├── frontend/                          # React 19 + Vite Frontend
│   ├── public/                        # Static assets & icons
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js              # Axios HTTP client configured for API communication
│   │   ├── components/
│   │   │   ├── RegionSelector.jsx     # Leaflet map picker + Open-Meteo geocoding search
│   │   │   ├── AnalysisControls.jsx   # Hazard selector, timeline sliders, trigger button
│   │   │   ├── TimeSeriesChart.jsx    # Dual-axis Chart.js frequency & duration trend
│   │   │   ├── IntensityChart.jsx     # Bubble chart mapping year, intensity & duration
│   │   │   ├── DurationHeatmap.jsx    # Calendar-style matrix visualization of annual events
│   │   │   ├── InsightsSummary.jsx    # Algorithmic climate insight generation & key metrics
│   │   │   ├── ExportPanel.jsx        # One-click CSV and PDF download actions
│   │   │   └── LoadingState.jsx       # Multi-step progress animations during data processing
│   │   ├── App.jsx                    # Root state management & layout shell
│   │   ├── index.css                  # Custom design tokens, dark theme, responsive grid
│   │   └── main.jsx                   # React DOM initialization
│   ├── package.json                   # Frontend npm dependencies & scripts
│   ├── vite.config.js                 # Vite bundling configuration & dev server proxy
│   └── index.html                     # HTML5 entry with metadata
├── .gitignore
└── README.md
```

### Technology Stack

| Layer | Technologies | Role / Justification |
|---|---|---|
| **Frontend UI** | React 19, Vite, Vanilla CSS | Fast rendering, modular component structure, dark-mode design system with zero Tailwind overhead |
| **Mapping & Geocoding** | Leaflet, React-Leaflet, Open-Meteo Geocoding | Interactive coordinate selection, bounding-box preview, autocomplete city searching |
| **Visualizations** | Chart.js 4, react-chartjs-2 | High-performance canvas-based dual-axis bar/line graphs, bubble charts, and intensity heatmaps |
| **Backend API** | FastAPI, Uvicorn, Python 3.10+ | Asynchronous endpoint handling, high throughput, automated OpenAPI documentation (`/docs`) |
| **Statistical Engine** | NumPy, Pandas, SciPy, PyMannKendall | Vectorized data processing, monotonic trend testing (Mann-Kendall), linear regression, moving windows |
| **Caching Tier** | MongoDB Atlas (Motor async) + DiskCache | Two-tier caching strategy: 7-day TTL cloud cache with seamless local disk cache fallback |
| **Export Engine** | ReportLab, Python CSV | Dynamic tabular data export and formatted PDF summary generation |
| **Security & Quality** | SlowAPI, Pydantic v2, Oxlint | Rate limiting (30 req/min/IP), strict geospatial validation, and linting |

### Data Flow Diagram

```
[ User Interaction ] ──> Selects Region (Map/Search), Hazard & Date Range (e.g., 1970–2023)
          │
          ▼
[ Frontend (React) ] ──> GET /api/v1/analyze?lat=...&lon=...&hazard=...
          │
          ▼
[ Backend (FastAPI) ]
          │
          ├──> 1. Check Cache (MongoDB TTL Collection -> DiskCache fallback)
          │         ├─ Hit: Return cached analysis immediately (< 50ms)
          │         └─ Miss: Proceed to ingestion pipeline
          │
          ├──> 2. Fetch Observations from Open-Meteo ERA5 API (Async HTTPX + Exponential Backoff)
          │         └─ Variables: tmax, tmin, precipitation, wind speed, wind gusts
          │
          ├──> 3. Clean & Validate Data (Gap interpolation, missing value imputation, quality scoring)
          │
          ├──> 4. Hazard Detection (Vectorized threshold evaluation & run-length grouping)
          │
          ├──> 5. Statistical Trend Analysis (Mann-Kendall test, OLS linear regression, 5-yr rolling avg)
          │
          ├──> 6. Generate Automated Insights & Summaries
          │
          ├──> 7. Store Result in Cache (TTL 7 Days)
          │
          ▼
[ JSON Response ] ──> Frontend renders Charts, Heatmap, Metrics, Insights & Export Triggers
```

---

## 📊 Data Source(s)

### 1. Open-Meteo Historical Weather API (ERA5 Reanalysis)
- **Endpoint**: `https://archive-api.open-meteo.com/v1/archive`
- **Provider**: ECMWF (European Centre for Medium-Range Weather Forecasts) ERA5 Reanalysis
- **Access**: Free, open-access, no API authentication key required.
- **Spatial Coverage**: Global terrestrial and oceanic grid, interpolated to ~0.25° resolution (~25 km at the equator).
- **Temporal Range**: 1940 through to near-present (archive updated with ~5 days latency).
- **Variables Ingested**:
  - `temperature_2m_max` (°C): Daily maximum 2-meter air temperature.
  - `temperature_2m_min` (°C): Daily minimum 2-meter air temperature.
  - `precipitation_sum` (mm): Daily total precipitation.
  - `wind_speed_10m_max` (km/h): Daily maximum wind speed at 10 meters above surface.
  - `wind_gusts_10m_max` (km/h): Daily maximum wind gust at 10 meters above surface.

### 2. Open-Meteo Geocoding API
- **Endpoint**: `https://geocoding-api.open-meteo.com/v1/search`
- **Access**: Free, real-time geocoding search for worldwide cities and administrative regions.
- **Attributes Extracted**: City name, administrative boundary (admin1 / state / province), country code, latitude, and longitude.

---

## 🔬 Hazard Detection & Statistical Logic

The engine supports multiple climate hazards and extreme weather phenomena. Algorithms are implemented in `backend/services/hazard_detector.py` and `backend/services/trend_analyzer.py`.

### 1. Hazard Detection Algorithms

#### A. Heatwaves (WMO / ETCCDI Aligned)
- **Criterion**: Daily maximum temperature ($T_{\text{max}}$) meets or exceeds the **95th percentile** of the historical baseline for **$\ge 3$ consecutive days**.
- **Metrics Tracked**: Annual event count, total duration (days), longest single heatwave duration, mean intensity ($T_{\text{max}} - \text{threshold}$ excess), and record peak temperature.
- **Reference**: World Meteorological Organization (WMO) and Expert Team on Climate Change Detection and Indices (ETCCDI - TX95p definition).

#### B. Cold Waves
- **Criterion**: Daily minimum temperature ($T_{\text{min}}$) falls to or below the **5th percentile** of the historical baseline for **$\ge 3$ consecutive days**.
- **Metrics Tracked**: Cold wave episodes, freeze duration, severity (degrees below threshold), and minimum recorded temperature.

#### C. Heavy Rainfall
- **Criterion**: Daily cumulative precipitation $\ge \max(20\text{ mm/day}, 95\text{th percentile})$.
- **Metrics Tracked**: Frequency of heavy deluge days, annual wet-event counts, and peak single-day precipitation.

#### D. Extreme Precipitation
- **Criterion**: Daily cumulative precipitation $\ge \max(30\text{ mm/day}, 99\text{th percentile})$ (R99p index).
- **Metrics Tracked**: Multi-decadal torrential rainfall frequencies and extreme event days.

#### E. Strong Winds
- **Criterion**: Maximum of daily sustained wind speed or wind gust $\ge 50\text{ km/h}$.
- **Metrics Tracked**: Gale/storm day counts, maximum gusts recorded.

#### F. Frost Days
- **Criterion**: Daily minimum temperature $T_{\text{min}} \le 0\ ^\circ\text{C}$ (freezing point).
- **Metrics Tracked**: Annual frost occurrence, seasonal shift patterns, and continuous frost runs.

#### G. Meteorological Drought (Precipitation-Deficit Indicator)
- **Criterion**: Rolling 90-day cumulative precipitation falling to or below the **20th percentile** of historical 90-day rolling sums for **$\ge 30$ consecutive days**.
- **Metrics Tracked**: Persistent dry period episodes, duration, and deficit magnitude.

#### H. Weather-Based Proxies (Flood & Wildfire)
- **Flood Proxy**: Potential flash-flood conditions defined by severe precipitation exceeding $\max(50\text{ mm/day}, 99\text{th percentile})$. *(Explicitly flagged as an atmospheric rainfall proxy; physical flood confirmation requires catchment, river gauge, and elevation data).*
- **Wildfire Danger Proxy**: Favorable fire weather defined by co-occurring hot, dry, and windy conditions: $T_{\text{max}} \ge 90\text{th percentile}$, daily precipitation $\le 1.0\text{ mm}$, and wind speed $\ge 25.0\text{ km/h}$ sustained for $\ge 3$ consecutive days. *(Flagged as a fire weather index proxy; fuel load and ignition data are required for fire confirmation).*
- **Thunderstorms**: Guarded with `NotImplementedError` because daily summary variables lack convective available potential energy (CAPE), lifted index, or lightning observation data.

---

### 2. Statistical Trend Analysis Logic

The backend executes a multi-pronged statistical evaluation to quantify long-term shifts:

```
                  ┌──────────────────────────────────────────────┐
                  │ Annual Time Series (1950–2023 Event Metrics) │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │  Mann-Kendall Test     │                     │ OLS Linear Regression  │
     │  (PyMannKendall)       │                     │ (SciPy Stats)          │
     ├────────────────────────┤                     ├────────────────────────┤
     │ • Non-parametric rank  │                     │ • Slope (events/year)  │
     │ • S statistic & z-score│                     │ • Slope / decade       │
     │ • Sen's Slope Estimator│                     │ • Coefficient of       │
     │ • p-value (α = 0.05)   │                     │   Determination (R²)   │
     │ • Trend: Inc/Dec/None  │                     │ • p-value on slope     │
     └────────────────────────┘                     └────────────────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │ 5-Year Centered Rolling Average & % Change   │
                 │ Baseline Window (T_start) vs Recent (T_end)  │
                 └──────────────────────────────────────────────┘
```

1. **Mann-Kendall Monotonic Test**:
   - Evaluates whether a monotonic upward or downward trend exists without assuming a normal distribution.
   - Computes Kendall's tau, normalized test statistic $Z$, Sen's slope estimator (median of pairwise slopes), and asymptotic two-sided $p$-value.
   - Significant at $\alpha = 0.05$ ($p < 0.05$).

2. **Ordinary Least Squares (OLS) Linear Regression**:
   - Fits $y = mx + c$ on annual event counts and durations.
   - Outputs annual slope, decadal rate of change ($\text{slope} \times 10$), and Pearson $R^2$.

3. **5-Year Centered Rolling Average**:
   - Smooths high-frequency interannual variability (e.g., ENSO cycles) to reveal decadal background trends.

4. **Multi-Decadal Relative Change**:
   - Computes percentage change comparing the initial 5-year baseline average with the most recent 5-year period.

---

## 📌 Assumptions & Methodological Constraints

1. **Climatological Baseline Definition**:
   - Threshold percentiles (e.g., 95th percentile for heatwaves) are calculated across the user-selected date range. While standard climatological normal periods (e.g., 1961–1990 or 1981–2010) provide stationary baselines, dynamically calculating across the analysis period prevents API fragmentation over arbitrary user queries.
2. **Spatial Grid Point Selection**:
   - Data points represent the nearest ERA5 centroid grid cell (~25 km resolution) corresponding to the requested latitude/longitude coordinate, rather than a spatial polygon average over municipal boundaries.
3. **Discrete Event Separation**:
   - In accordance with run-length encoding standards, events separated by a single non-extreme day are treated as two distinct episodes rather than merged into a single broken run.
4. **Coordinate Discretization for Performance**:
   - Geographic coordinates are rounded to 2 decimal places (~1.1 km resolution) before cache evaluation. This maximizes cache hit rates for identical metropolitan areas without sacrificing meteorological accuracy.
5. **Time Horizon Minimums & Archive Cutoff**:
   - The analysis requires a minimum of 5 years of historical data to maintain sufficient statistical power for trend testing. The upper year limit defaults to 2023/2024 to ensure full calendar year availability.
6. **Hazard Proxies vs. Impact Realities**:
   - Heavy precipitation and fire weather indices represent atmospheric hazard potential, not realized catastrophic inundation or ignited blazes. Ground hydrological features, urban drainage, and vegetative fuel moisture determine actual surface impacts.

---

## ⚡ Setup & Installation

### Prerequisites
- **Python**: 3.10, 3.11, or 3.12
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB** *(Optional)*: MongoDB Atlas connection URI or local MongoDB instance. If omitted, the application automatically uses a fast local `diskcache`.

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv env

# Activate virtual environment
# Windows (PowerShell):
.\env\Scripts\Activate.ps1
# Windows (cmd.exe):
.\env\Scripts\activate.bat
# Linux/macOS:
source env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

#### Backend Environment Variables (`backend/.env`):
```ini
# Port and Host
PORT=8000
HOST=0.0.0.0

# CORS Allowed Origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Optional: MongoDB Atlas URI (leave empty to use local diskcache)
MONGODB_URI=
MONGODB_DB_NAME=climate_hazard_analyzer

# Cache TTL in seconds (default: 7 days = 604800)
CACHE_TTL_SECONDS=604800

# Rate Limiting
RATE_LIMIT_PER_MINUTE=30
```

#### Run Backend Server:
```bash
uvicorn main:app --reload --port 8000
```
- API Endpoint: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# (Optional) Create .env file if modifying API URL
# By default, Vite proxies requests or connects to http://localhost:8000
```

#### Frontend Environment Variables (`frontend/.env` - optional):
```ini
VITE_API_URL=http://localhost:8000/api/v1
```

#### Run Frontend Dev Server:
```bash
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 🌐 Deployment Guide

### Backend (Render / Railway / Fly.io)
1. Set **Root Directory** to `backend`.
2. **Build Command**: `pip install -r requirements.txt`
3. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables**:
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`
   - `MONGODB_URI`: Your MongoDB Atlas connection string (or omit to use diskcache)
   - `CACHE_TTL_SECONDS`: `604800`

### Frontend (Vercel / Netlify)
1. Set **Root Directory** to `frontend`.
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Environment Variables**:
   - `VITE_API_URL`: `https://your-backend.onrender.com/api/v1`

---

## 🚀 What Would Be Improved With More Time

1. **Fixed Baseline Reference Climatologies (WMO 1961–1990 & 1981–2010)**:
   - Compute moving day-of-year threshold percentiles (e.g., 5-day window centered on each calendar day) to isolate seasonal heat anomalies from normal summer warming.
2. **Spatial Polygon & Bounding Box Averaging**:
   - Permit users to draw freeform polygons or bounding boxes on the Leaflet map and compute area-weighted spatial averages across multiple ERA5 grid cells.
3. **Standardized Drought Indices (SPI & SPEI)**:
   - Incorporate the Standardized Precipitation Index (SPI) and Standardized Precipitation Evapotranspiration Index (SPEI) by integrating Thornthwaite or Penman-Monteith potential evapotranspiration equations.
4. **IPCC CMIP6 Future Climate Projections**:
   - Overlay Shared Socioeconomic Pathways (SSP1-2.6, SSP2-4.5, SSP5-8.5) from CMIP6 models to contrast historical trends against 2025–2100 climate trajectories.
5. **Multi-Region Comparative Dashboard**:
   - Enable side-by-side comparative analysis of two or more global regions to compare climate vulnerability and warming acceleration.
6. **Server-Sent Events (SSE) / Streaming Response**:
   - Provide real-time data ingestion feedback and progressive chunk rendering for 80-year long-term queries.
7. **Vector Tile & WebGL Rendering**:
   - Upgrade map visualizations with MapLibre GL and deck.gl to display regional temperature contour anomalies directly on the globe.
8. **Automated End-to-End Testing Suite**:
   - Add comprehensive test suites with `pytest` for statistical edge cases and `Playwright` / `Cypress` for frontend integration verification.

---

## 🤖 AI Tools Used & Methodology

This project utilized modern artificial intelligence developer tooling to accelerate system architecture, statistical modeling, and full-stack implementation:

### 1. Tools Employed
- **Antigravity (Google DeepMind)**: Served as the primary autonomous pair-programming agent and system architect throughout development.
- **Gemini 3.8 Flash / Thinking Models**: Utilized for algorithmic reasoning, statistical validation, and vectorized NumPy/Pandas computation optimization.

### 2. Implementation Methodology
- **Architectural Scaffolding**: Generated clean full-stack separation between FastAPI services and React components, establishing Pydantic data contracts and resilient API schemas.
- **Statistical Formulation**: Assisted in formulating the Mann-Kendall non-parametric monotonic trend test, Sen's slope estimation, and vectorized run-length encoding for contiguous extreme event detection in compliance with WMO and ETCCDI guidelines.
- **Visualization Design**: Synthesized interactive Chart.js layouts, dual-axis scaling, dynamic bubble chart calculations, and a high-contrast dark theme design system.
- **Two-Tier Resilient Caching**: Drafted a failover caching mechanism combining MongoDB Atlas TTL indexing with local disk-backed storage to ensure uninterrupted functionality regardless of database availability.
- **Verification & Review**: All AI-generated algorithms, API routes, and front-end interactions underwent manual code review, linting validation (oxlint, flake8), and live browser integration testing.

---

## 📝 License

Distributed under the **MIT License**. See `LICENSE` for more information. Free to use, adapt, and distribute for academic, scientific, and commercial applications.
