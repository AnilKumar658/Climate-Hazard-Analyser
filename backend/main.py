"""
Climate Hazard Trend Analyzer — FastAPI Application Entry Point

Architecture:
  - FastAPI with async routes
  - slowapi rate limiting (30 req/min per IP)
  - MongoDB TTL cache + diskcache fallback
  - CORS configured for frontend dev server
"""
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from db.mongodb import connect_db, close_db
from routers.weather import router as weather_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("[START] Starting Climate Hazard Trend Analyzer API")
    await connect_db()
    yield
    logger.info("[STOP] Shutting down...")
    await close_db()


app = FastAPI(
    title="Climate Hazard Trend Analyzer API",
    description=(
        "Analyzes historical weather data to detect and visualize climate hazard trends. "
        "Uses Open-Meteo ERA5 reanalysis data. Heatwave definition: 3+ consecutive days "
        "with tmax > 95th percentile of historical baseline."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
app.include_router(weather_router, prefix="/api/v1", tags=["Climate Analysis"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "Climate Hazard Trend Analyzer",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
