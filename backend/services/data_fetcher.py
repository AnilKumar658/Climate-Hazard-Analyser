# """
# Data fetcher service: Fetches historical daily weather data from Open-Meteo API.
# Open-Meteo provides free ERA5 reanalysis data (1940–present) without an API key.
# Includes retry logic, timeout handling, and data quality reporting.
# """
# import asyncio
# import logging
# from datetime import date
# from typing import Tuple
# import httpx
# import pandas as pd
# import numpy as np

# logger = logging.getLogger(__name__)

# OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
# OPEN_METEO_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"

# # Maximum retries for external API calls
# MAX_RETRIES = 3
# RETRY_DELAY = 2  # seconds


# async def fetch_weather_data(
#     lat: float,
#     lon: float,
#     start_year: int,
#     end_year: int,
# ) -> Tuple[pd.DataFrame, dict]:
#     """
#     Fetch daily maximum temperature data from Open-Meteo ERA5 archive.
    
#     Returns:
#         df: DataFrame with columns [date, tmax] indexed by date
#         quality: dict with data quality stats
#     """
#     start_date = f"{start_year}-01-01"
#     end_date = f"{min(end_year, 2024)}-12-31"

#     params = {
#         "latitude": round(lat, 4),
#         "longitude": round(lon, 4),
#         "start_date": start_date,
#         "end_date": end_date,
#         "daily": "temperature_2m_max,temperature_2m_min",
#         "timezone": "auto",
#         "temperature_unit": "celsius",
#     }

#     logger.info(f"Fetching Open-Meteo data: lat={lat}, lon={lon}, {start_date}→{end_date}")

#     last_error = None
#     for attempt in range(1, MAX_RETRIES + 1):
#         try:
#             async with httpx.AsyncClient(timeout=60.0) as client:
#                 response = await client.get(OPEN_METEO_ARCHIVE_URL, params=params)
#                 response.raise_for_status()
#                 data = response.json()
#                 break
#         except httpx.HTTPStatusError as e:
#             last_error = e
#             logger.warning(f"Attempt {attempt}/{MAX_RETRIES}: HTTP error {e.response.status_code}")
#             if attempt < MAX_RETRIES:
#                 await asyncio.sleep(RETRY_DELAY * attempt)
#         except (httpx.ConnectError, httpx.TimeoutException) as e:
#             last_error = e
#             logger.warning(f"Attempt {attempt}/{MAX_RETRIES}: Connection error: {e}")
#             if attempt < MAX_RETRIES:
#                 await asyncio.sleep(RETRY_DELAY * attempt)
#     else:
#         raise RuntimeError(f"Failed to fetch weather data after {MAX_RETRIES} attempts: {last_error}")

#     # Parse response
#     daily = data.get("daily", {})
#     dates = daily.get("time", [])
#     tmax = daily.get("temperature_2m_max", [])
#     tmin = daily.get("temperature_2m_min", [])

#     if not dates:
#         raise ValueError("No data returned from Open-Meteo API")

#     df = pd.DataFrame({"date": pd.to_datetime(dates), "tmax": tmax, "tmin": tmin})
#     df.set_index("date", inplace=True)

#     # Data quality assessment
#     total_days = len(df)
#     missing_tmax = df["tmax"].isna().sum()
#     missing_tmin = df["tmin"].isna().sum()

#     # Fill small gaps (≤3 days) with linear interpolation
#     df["tmax"] = df["tmax"].interpolate(method="linear", limit=3)
#     df["tmin"] = df["tmin"].interpolate(method="linear", limit=3)

#     # Flag remaining missing as outlier-treated
#     remaining_missing = df["tmax"].isna().sum()

#     # Remove extreme outliers (beyond ±4 std dev) — treat as sensor errors
#     mean_t = df["tmax"].mean()
#     std_t = df["tmax"].std()
#     outlier_mask = (df["tmax"] - mean_t).abs() > 4 * std_t
#     outlier_count = outlier_mask.sum()
#     df.loc[outlier_mask, "tmax"] = np.nan
#     df["tmax"] = df["tmax"].interpolate(method="linear", limit=5)

#     quality = {
#         "total_days": total_days,
#         "originally_missing_days": int(missing_tmax),
#         "interpolated_days": int(missing_tmax - remaining_missing),
#         "outlier_days_removed": int(outlier_count),
#         "final_missing_days": int(df["tmax"].isna().sum()),
#         "coverage_pct": round(
#             (1 - df["tmax"].isna().sum() / total_days) * 100, 2
#         ),
#     }

#     logger.info(
#         f"Data fetched: {total_days} days, {quality['coverage_pct']}% coverage, "
#         f"{outlier_count} outliers removed"
#     )
#     return df, quality


# async def geocode_city(query: str, limit: int = 5) -> list:
#     """
#     Search for city coordinates using Open-Meteo Geocoding API.
#     Returns list of GeocodingResult dicts.
#     """
#     params = {"name": query.strip(), "count": limit, "language": "en", "format": "json"}

#     async with httpx.AsyncClient(timeout=10.0) as client:
#         try:
#             response = await client.get(OPEN_METEO_GEO_URL, params=params)
#             response.raise_for_status()
#             data = response.json()
#         except Exception as e:
#             logger.error(f"Geocoding error: {e}")
#             return []

#     results = []
#     for r in data.get("results", []):
#         results.append({
#             "name": r.get("name", ""),
#             "lat": r.get("latitude", 0),
#             "lon": r.get("longitude", 0),
#             "country": r.get("country", ""),
#             "admin1": r.get("admin1", ""),
#         })
#     return results




"""Fetch daily weather observations used by the hazard detectors."""

import asyncio
from datetime import date
from typing import Any

import httpx
import pandas as pd

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

DAILY_VARIABLES = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
]


async def fetch_weather_data(
    lat: float,
    lon: float,
    start_year: int,
    end_year: int,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Fetch daily weather data.

    Returns:
        DataFrame indexed by date with columns:
        tmax, tmin, precipitation_mm, wind_speed_kmh, wind_gust_kmh

        A data-quality dictionary describing the actual returned coverage.

    Note:
        The historical archive may not contain every requested date. This
        implementation retains the project's existing 2024 archive cutoff;
        year-range handling can be updated separately after hazard detection.
    """
    actual_end_year = min(end_year, 2024)
    start_date = f"{start_year}-01-01"
    end_date = f"{actual_end_year}-12-31"

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join(DAILY_VARIABLES),
        "timezone": "auto",
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    }

    last_error: Exception | None = None
    payload: dict[str, Any] | None = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(3):
            try:
                response = await client.get(OPEN_METEO_ARCHIVE_URL, params=params)
                response.raise_for_status()
                payload = response.json()
                break
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))

    if payload is None:
        raise RuntimeError(f"Weather data provider request failed: {last_error}")

    daily = payload.get("daily")
    if not daily or not daily.get("time"):
        raise RuntimeError("Weather provider returned no daily data for this date range.")

    df = pd.DataFrame({
        "date": pd.to_datetime(daily["time"]),
        "tmax": daily.get("temperature_2m_max"),
        "tmin": daily.get("temperature_2m_min"),
        "precipitation_mm": daily.get("precipitation_sum"),
        "wind_speed_kmh": daily.get("wind_speed_10m_max"),
        "wind_gust_kmh": daily.get("wind_gusts_10m_max"),
    }).set_index("date").sort_index()

    expected_days = max(
        1,
        (pd.Timestamp(end_date) - pd.Timestamp(start_date)).days + 1,
    )
    returned_days = len(df)
    valid_temperature_days = int(df[["tmax", "tmin"]].notna().all(axis=1).sum())

    quality = {
        "requested_start_date": start_date,
        "requested_end_date": f"{end_year}-12-31",
        "actual_start_date": df.index.min().strftime("%Y-%m-%d"),
        "actual_end_date": df.index.max().strftime("%Y-%m-%d"),
        "requested_end_year_clipped_to": actual_end_year if end_year > 2024 else None,
        "days_returned": returned_days,
        "expected_days_within_archive_cutoff": expected_days,
        "coverage_percent": round(returned_days / expected_days * 100, 2),
        "valid_temperature_days": valid_temperature_days,
        "missing_by_variable": {
            column: int(df[column].isna().sum()) for column in df.columns
        },
        "available_variables": [
            column for column in df.columns if df[column].notna().any()
        ],
        "source": "Open-Meteo Historical Weather API",
    }

    return df, quality


async def geocode_city(city: str) -> list[dict[str, Any]]:
    """Search for cities using Open-Meteo's geocoding service."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": city, "count": 10, "language": "en", "format": "json"}

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    results = payload.get("results", [])
    return [
        {
            "name": item.get("name", ""),
            "lat": item.get("latitude"),
            "lon": item.get("longitude"),
            "country": item.get("country", ""),
            "admin1": item.get("admin1"),
        }
        for item in results
    ]
