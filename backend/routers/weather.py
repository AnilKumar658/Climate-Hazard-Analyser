# """
# Main API router for weather/climate hazard analysis endpoints.
# All routes are prefixed with /api/v1 (set in main.py).
# """
# import logging
# from fastapi import APIRouter, HTTPException, Query, Request
# from fastapi.responses import StreamingResponse, Response
# import io

# from models.schemas import AnalyzeResponse, GeocodingResult, HazardType
# from services.data_fetcher import fetch_weather_data, geocode_city
# from services.hazard_detector import detect_heatwaves, compute_yearly_stats
# from services.trend_analyzer import compute_trend, generate_insights
# from services.cache_service import get_cached, set_cached
# from services.export_service import generate_csv, generate_pdf

# logger = logging.getLogger(__name__)
# router = APIRouter()


# @router.get("/analyze", response_model=AnalyzeResponse)
# async def analyze_hazard(
#     lat: float = Query(..., ge=-90, le=90, description="Latitude"),
#     lon: float = Query(..., ge=-180, le=180, description="Longitude"),
#     start_year: int = Query(..., ge=1950, le=2023),
#     end_year: int = Query(..., ge=1951, le=2024),
#     hazard: HazardType = Query(HazardType.heatwave),
#     region_name: str = Query("Selected Region", max_length=100),
# ):
#     """
#     Analyze climate hazards for a given location and time range.
#     Returns yearly statistics, trend analysis, and insights.
#     Results are cached for 7 days.
#     """
#     if end_year <= start_year:
#         raise HTTPException(400, "end_year must be greater than start_year")
#     if (end_year - start_year) < 4:
#         raise HTTPException(400, "Date range must be at least 5 years for trend analysis")

#     # Round coordinates to ~10km precision for better cache hit rate
#     lat_r = round(lat, 2)
#     lon_r = round(lon, 2)

#     cache_params = {
#         "lat": lat_r, "lon": lon_r,
#         "start_year": start_year, "end_year": end_year,
#         "hazard": hazard.value,
#     }

#     # Check cache
#     cached = await get_cached(cache_params)
#     if cached:
#         cached["cached"] = True
#         cached["region_name"] = region_name  # Update with fresh region name
#         return AnalyzeResponse(**cached)

#     try:
#         # 1. Fetch weather data
#         df, quality = await fetch_weather_data(lat_r, lon_r, start_year, end_year)

#         # 2. Detect heatwave events
#         threshold, events = detect_heatwaves(df)

#         # 3. Compute yearly statistics
#         yearly_stats = compute_yearly_stats(events, start_year, min(end_year, 2024))

#         # 4. Trend analysis
#         trend, rolling_avg = compute_trend(yearly_stats)

#         # 5. Generate insights
#         insights = generate_insights(trend, yearly_stats, region_name, threshold)

#         result = AnalyzeResponse(
#             region_name=region_name,
#             lat=lat_r,
#             lon=lon_r,
#             start_year=start_year,
#             end_year=end_year,
#             hazard=hazard.value,
#             threshold_temp=round(threshold, 2),
#             yearly_stats=yearly_stats,
#             trend=trend,
#             insights=insights,
#             rolling_avg_5yr=rolling_avg,
#             data_quality=quality,
#             cached=False,
#         )

#         # Store in cache (excluding the cached flag)
#         cache_data = result.model_dump()
#         cache_data.pop("cached", None)
#         await set_cached(cache_params, cache_data)

#         return result

#     except ValueError as e:
#         raise HTTPException(422, str(e))
#     except RuntimeError as e:
#         raise HTTPException(503, f"External API error: {e}")
#     except Exception as e:
#         logger.exception(f"Unexpected error in analyze_hazard: {e}")
#         raise HTTPException(500, "Internal server error")


# @router.get("/regions/search", response_model=list[GeocodingResult])
# async def search_regions(
#     q: str = Query(..., min_length=2, max_length=100, description="City or region name"),
#     limit: int = Query(5, ge=1, le=10),
# ):
#     """Search for geographic regions by name using Open-Meteo geocoding."""
#     try:
#         results = await geocode_city(q.strip(), limit=limit)
#         return [GeocodingResult(**r) for r in results]
#     except Exception as e:
#         logger.error(f"Geocoding error: {e}")
#         raise HTTPException(503, "Geocoding service unavailable")


# @router.get("/export/csv")
# async def export_csv(
#     lat: float = Query(..., ge=-90, le=90),
#     lon: float = Query(..., ge=-180, le=180),
#     start_year: int = Query(..., ge=1950, le=2023),
#     end_year: int = Query(..., ge=1951, le=2024),
#     hazard: HazardType = Query(HazardType.heatwave),
#     region_name: str = Query("Selected Region", max_length=100),
# ):
#     """Export analysis results as CSV."""
#     result = await analyze_hazard(lat, lon, start_year, end_year, hazard, region_name)
#     csv_bytes = generate_csv(result)
#     filename = f"climate_hazard_{region_name.replace(' ', '_')}_{start_year}_{end_year}.csv"
#     return Response(
#         content=csv_bytes,
#         media_type="text/csv",
#         headers={"Content-Disposition": f'attachment; filename="{filename}"'},
#     )


# @router.get("/export/pdf")
# async def export_pdf(
#     lat: float = Query(..., ge=-90, le=90),
#     lon: float = Query(..., ge=-180, le=180),
#     start_year: int = Query(..., ge=1950, le=2023),
#     end_year: int = Query(..., ge=1951, le=2024),
#     hazard: HazardType = Query(HazardType.heatwave),
#     region_name: str = Query("Selected Region", max_length=100),
# ):
#     """Export analysis results as PDF report."""
#     result = await analyze_hazard(lat, lon, start_year, end_year, hazard, region_name)
#     pdf_bytes = generate_pdf(result)
#     filename = f"climate_hazard_{region_name.replace(' ', '_')}_{start_year}_{end_year}.pdf"
#     return Response(
#         content=pdf_bytes,
#         media_type="application/pdf",
#         headers={"Content-Disposition": f'attachment; filename="{filename}"'},
#     )


# @router.get("/health")
# async def health():
#     """Health check endpoint."""
#     from db.mongodb import get_db
#     db_status = "connected" if get_db() is not None else "disconnected (using disk cache)"
#     return {"status": "ok", "database": db_status}










"""
Main API router for weather/climate hazard analysis endpoints.
All routes are prefixed with /api/v1 (set in main.py).
"""
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from models.schemas import AnalyzeResponse, GeocodingResult, HazardType, YearlyStats
from services.data_fetcher import fetch_weather_data, geocode_city
from services.hazard_detector import detect_hazard
from services.trend_analyzer import compute_trend, generate_insights
from services.cache_service import get_cached, set_cached
from services.export_service import generate_csv, generate_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


def _yearly_stats_for_response(rows: list[dict]) -> list[YearlyStats]:
    """
    Adapt hazard-neutral detector results to the current response schema.

    NOTE: The current YearlyStats schema calls the generic maximum
    `max_temp_recorded`. That field name is misleading for non-temperature
    hazards. A follow-up schema change should rename it to `max_value_recorded`.
    """
    result = []
    for row in rows:
        maximum = row.get("max_value_recorded")
        result.append(
            YearlyStats(
                year=int(row["year"]),
                event_count=int(row["event_count"]),
                total_duration_days=int(row["total_duration_days"]),
                mean_intensity=float(row["mean_intensity"]),
                max_temp_recorded=float(maximum) if maximum is not None else 0.0,
                longest_event_days=int(row["longest_event_days"]),
            )
        )
    return result


@router.get("/analyze", response_model=AnalyzeResponse)
async def analyze_hazard(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    start_year: int = Query(..., ge=1950),
    end_year: int = Query(..., ge=1951),
    hazard: HazardType = Query(HazardType.heatwave),
    region_name: str = Query("Selected Region", max_length=100),
):
    """Analyze a selected hazard and return yearly statistics and trends."""
    if end_year <= start_year:
        raise HTTPException(400, "end_year must be greater than start_year")
    if end_year - start_year < 4:
        raise HTTPException(400, "Date range must be at least 5 years for trend analysis")

    lat_r, lon_r = round(lat, 2), round(lon, 2)
    cache_params = {
        "lat": lat_r,
        "lon": lon_r,
        "start_year": start_year,
        "end_year": end_year,
        "hazard": hazard.value,
    }

    try:
        cached = await get_cached(cache_params)
        if cached:
            cached["cached"] = True
            cached["region_name"] = region_name
            return AnalyzeResponse(**cached)

        df, quality = await fetch_weather_data(lat_r, lon_r, start_year, end_year)

        # Run the detector corresponding to the requested hazard.
        detection = detect_hazard(df, hazard.value, start_year, min(end_year, 2024))
        threshold = detection["threshold_value"]
        yearly_stats = _yearly_stats_for_response(detection["yearly_stats"])

        # Trend calculations operate on the selected hazard's yearly statistics.
        trend, rolling_avg = compute_trend(yearly_stats)
        insights = generate_insights(
            trend, yearly_stats, region_name, threshold,
            hazard=hazard.value,
            threshold_label=detection.get("threshold_label"),
            threshold_unit=detection.get("unit"),
        )

        # Add detector-specific context without changing the current InsightSummary schema.
        details = list(getattr(insights, "details", []) or [])
        details.extend(detection.get("notes", []))
        if hasattr(insights, "model_copy"):
            insights = insights.model_copy(update={"details": details})

        result = AnalyzeResponse(
            region_name=region_name,
            lat=lat_r,
            lon=lon_r,
            start_year=start_year,
            end_year=min(end_year, 2024),
            hazard=hazard.value,
            threshold_temp=round(float(threshold), 2),
            yearly_stats=yearly_stats,
            trend=trend,
            insights=insights,
            rolling_avg_5yr=rolling_avg,
            data_quality=quality,
            cached=False,
        )

        cache_data = result.model_dump()
        cache_data.pop("cached", None)
        await set_cached(cache_params, cache_data)
        return result

    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"External API error: {exc}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error in analyze_hazard: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/regions/search", response_model=list[GeocodingResult])
async def search_regions(
    q: str = Query(..., min_length=2, max_length=100, description="City or region name"),
    limit: int = Query(5, ge=1, le=10),
):
    """Search for geographic regions by name using Open-Meteo geocoding."""
    try:
        results = await geocode_city(q.strip(), limit=limit)
        return [GeocodingResult(**item) for item in results]
    except Exception as exc:
        logger.error("Geocoding error: %s", exc)
        raise HTTPException(503, "Geocoding service unavailable")


@router.get("/export/csv")
async def export_csv(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    start_year: int = Query(..., ge=1950),
    end_year: int = Query(..., ge=1951),
    hazard: HazardType = Query(HazardType.heatwave),
    region_name: str = Query("Selected Region", max_length=100),
):
    """Export the selected hazard analysis as CSV."""
    result = await analyze_hazard(lat, lon, start_year, end_year, hazard, region_name)
    csv_bytes = generate_csv(result)
    filename = f"climate_hazard_{region_name.replace(' ', '_')}_{start_year}_{end_year}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/pdf")
async def export_pdf(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    start_year: int = Query(..., ge=1950),
    end_year: int = Query(..., ge=1951),
    hazard: HazardType = Query(HazardType.heatwave),
    region_name: str = Query("Selected Region", max_length=100),
):
    """Export the selected hazard analysis as PDF."""
    result = await analyze_hazard(lat, lon, start_year, end_year, hazard, region_name)
    pdf_bytes = generate_pdf(result)
    filename = f"climate_hazard_{region_name.replace(' ', '_')}_{start_year}_{end_year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/health")
async def health():
    """Health check endpoint."""
    from db.mongodb import get_db

    db_status = "connected" if get_db() is not None else "disconnected (using disk cache)"
    return {"status": "ok", "database": db_status}
