# """
# Hazard detection service: Implements the heatwave detection algorithm.

# Heatwave Definition (WMO-aligned):
#   A heatwave occurs when the daily maximum temperature (tmax) exceeds the 95th
#   percentile of the historical baseline for 3 or more consecutive days.

# Baseline: The 95th percentile is computed from the full dataset (all years in
#   the provided range). For more rigorous analysis, a fixed 1981-2010 baseline
#   would be preferable, but is not always achievable within a single API call.

# Assumptions documented:
#   - We use the full-period p95 as the threshold (stated in README).
#   - Events shorter than 3 days are not counted.
#   - Back-to-back events with a single non-heatwave day are kept separate.
# """
# import logging
# from typing import List, Tuple
# import pandas as pd
# import numpy as np
# from models.schemas import HeatwaveEvent, YearlyStats

# logger = logging.getLogger(__name__)


# def detect_heatwaves(
#     df: pd.DataFrame,
#     percentile: float = 95.0,
#     min_consecutive_days: int = 3,
# ) -> Tuple[float, List[HeatwaveEvent]]:
#     """
#     Detect heatwave events in the temperature time series.

#     Args:
#         df: DataFrame with DatetimeIndex and 'tmax' column (°C)
#         percentile: threshold percentile (default 95th)
#         min_consecutive_days: minimum consecutive hot days to qualify

#     Returns:
#         threshold: the computed temperature threshold (°C)
#         events: list of HeatwaveEvent objects
#     """
#     # Drop rows where tmax is missing (can't determine if it's a hot day)
#     valid = df["tmax"].dropna()

#     if len(valid) < 365:
#         raise ValueError("Insufficient data for heatwave detection (need ≥ 1 year)")

#     # Compute the percentile threshold from the full dataset
#     threshold = float(np.percentile(valid.values, percentile))
#     logger.info(f"Heatwave threshold ({percentile}th percentile): {threshold:.2f}°C")

#     # Mark hot days
#     df = df.copy()
#     df["hot"] = df["tmax"] > threshold

#     # Find consecutive runs of hot days using run-length encoding
#     events: List[HeatwaveEvent] = []
#     in_run = False
#     run_start = None
#     run_data = []

#     for idx, (date, row) in enumerate(df.iterrows()):
#         if row["hot"] is True or (not pd.isna(row["tmax"]) and row["tmax"] > threshold):
#             if not in_run:
#                 in_run = True
#                 run_start = date
#                 run_data = []
#             run_data.append(row["tmax"])
#         else:
#             if in_run:
#                 # End of a potential heatwave run
#                 duration = len(run_data)
#                 if duration >= min_consecutive_days:
#                     run_end = df.index[df.index.get_loc(date) - 1]
#                     events.append(HeatwaveEvent(
#                         year=run_start.year,
#                         start_date=run_start.strftime("%Y-%m-%d"),
#                         end_date=run_end.strftime("%Y-%m-%d"),
#                         duration_days=duration,
#                         max_temp=round(float(np.max(run_data)), 2),
#                         mean_excess=round(float(np.mean(run_data)) - threshold, 2),
#                     ))
#                 in_run = False
#                 run_data = []

#     # Handle run that extends to end of dataset
#     if in_run and len(run_data) >= min_consecutive_days:
#         run_end = df.index[-1]
#         events.append(HeatwaveEvent(
#             year=run_start.year,
#             start_date=run_start.strftime("%Y-%m-%d"),
#             end_date=run_end.strftime("%Y-%m-%d"),
#             duration_days=len(run_data),
#             max_temp=round(float(np.max(run_data)), 2),
#             mean_excess=round(float(np.mean(run_data)) - threshold, 2),
#         ))

#     logger.info(f"Detected {len(events)} heatwave events")
#     return threshold, events


# def compute_yearly_stats(
#     events: List[HeatwaveEvent],
#     start_year: int,
#     end_year: int,
# ) -> List[YearlyStats]:
#     """
#     Aggregate heatwave events into per-year statistics.
#     Years with zero events are explicitly included with zero counts.
#     """
#     # Group events by year
#     year_map: dict = {yr: [] for yr in range(start_year, end_year + 1)}
#     for evt in events:
#         if evt.year in year_map:
#             year_map[evt.year].append(evt)

#     stats = []
#     for year in range(start_year, end_year + 1):
#         evts = year_map[year]
#         if evts:
#             stats.append(YearlyStats(
#                 year=year,
#                 event_count=len(evts),
#                 total_duration_days=sum(e.duration_days for e in evts),
#                 mean_intensity=round(float(np.mean([e.mean_excess for e in evts])), 2),
#                 max_temp_recorded=round(float(max(e.max_temp for e in evts)), 2),
#                 longest_event_days=max(e.duration_days for e in evts),
#             ))
#         else:
#             stats.append(YearlyStats(
#                 year=year,
#                 event_count=0,
#                 total_duration_days=0,
#                 mean_intensity=0.0,
#                 max_temp_recorded=0.0,
#                 longest_event_days=0,
#             ))

#     return stats







"""Hazard-specific detection algorithms based on daily weather data.

Supported from the currently fetched variables:
- heatwave, cold_wave, heavy_rainfall, drought, strong_winds,
  extreme_precipitation, frost
- flood and wildfire are explicitly weather-based proxies, not confirmation
  of observed flood/fire events.
- thunderstorm requires lightning/storm observations or suitable atmospheric
  instability variables and therefore raises NotImplementedError for now.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


SUPPORTED_HAZARDS = {
    "heatwave",
    "cold_wave",
    "heavy_rainfall",
    "drought",
    "flood",
    "strong_winds",
    "wildfire",
    "thunderstorm",
    "extreme_precipitation",
    "frost",
}


def _column(df: pd.DataFrame, name: str) -> pd.Series:
    if name not in df.columns:
        raise ValueError(
            f"Required weather variable '{name}' is missing. "
            "Update the data fetcher before running this hazard."
        )
    series = pd.to_numeric(df[name], errors="coerce")
    if series.notna().sum() == 0:
        raise ValueError(f"No valid observations are available for '{name}'.")
    return series


def _contiguous_events(
    df: pd.DataFrame,
    condition: pd.Series,
    value: pd.Series,
    *,
    hazard: str,
    threshold: float,
    unit: str,
    min_days: int,
    direction: str = "high",
) -> list[dict[str, Any]]:
    """Convert a daily Boolean condition into contiguous event records."""
    condition = condition.reindex(df.index).fillna(False).astype(bool)
    value = value.reindex(df.index)
    events: list[dict[str, Any]] = []
    active: list[pd.Timestamp] = []

    def finish_event(days: list[pd.Timestamp]) -> None:
        if len(days) < min_days:
            return
        vals = value.loc[days].dropna()
        if vals.empty:
            return
        if direction == "low":
            peak = float(vals.min())
        else:
            peak = float(vals.max())

        events.append({
            "hazard": hazard,
            "year": int(days[0].year),
            "start_date": days[0].strftime("%Y-%m-%d"),
            "end_date": days[-1].strftime("%Y-%m-%d"),
            "duration_days": len(days),
            "peak_value": round(peak, 2),
            "mean_value": round(float(vals.mean()), 2),
            "threshold_value": round(float(threshold), 2),
            "unit": unit,
        })

    for day in df.index:
        if bool(condition.loc[day]):
            active.append(pd.Timestamp(day))
        else:
            finish_event(active)
            active = []
    finish_event(active)
    return events


def _yearly_stats(
    events: list[dict[str, Any]],
    start_year: int,
    end_year: int,
) -> list[dict[str, Any]]:
    """Produce hazard-neutral yearly statistics for charting and trend analysis."""
    rows: list[dict[str, Any]] = []
    for year in range(start_year, end_year + 1):
        year_events = [event for event in events if event["year"] == year]
        durations = [event["duration_days"] for event in year_events]
        values = [event["peak_value"] for event in year_events]
        means = [event["mean_value"] for event in year_events]
        rows.append({
            "year": year,
            "event_count": len(year_events),
            "total_duration_days": int(sum(durations)),
            "mean_intensity": round(float(np.mean(means)), 2) if means else 0.0,
            "max_value_recorded": round(float(max(values)), 2) if values else None,
            "longest_event_days": int(max(durations)) if durations else 0,
        })
    return rows


def detect_hazard(
    df: pd.DataFrame,
    hazard: str,
    start_year: int | None = None,
    end_year: int | None = None,
) -> dict[str, Any]:
    """Run the detector selected by the API and return normalized results."""
    hazard = getattr(hazard, "value", hazard)
    if hazard not in SUPPORTED_HAZARDS:
        raise ValueError(f"Unknown hazard '{hazard}'.")

    if df.empty:
        raise ValueError("No weather data is available for this region and period.")

    df = df.sort_index().copy()
    if not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError("Weather DataFrame must have a DatetimeIndex.")

    first_year = start_year if start_year is not None else int(df.index.min().year)
    last_year = end_year if end_year is not None else int(df.index.max().year)
    notes: list[str] = []
    threshold_label = ""
    unit = ""
    min_days = 1
    direction = "high"

    if hazard == "heatwave":
        values = _column(df, "tmax")
        threshold = float(values.quantile(0.95))
        condition = values >= threshold
        min_days, unit, threshold_label = 3, "°C", "95th percentile of daily maximum temperature"
        direction = "high"

    elif hazard == "cold_wave":
        values = _column(df, "tmin")
        threshold = float(values.quantile(0.05))
        condition = values <= threshold
        min_days, unit, threshold_label = 3, "°C", "5th percentile of daily minimum temperature"
        direction = "low"

    elif hazard == "heavy_rainfall":
        values = _column(df, "precipitation_mm")
        threshold = max(20.0, float(values.quantile(0.95)))
        condition = values >= threshold
        unit, threshold_label = "mm/day", "maximum of 20 mm/day and the 95th precipitation percentile"

    elif hazard == "extreme_precipitation":
        values = _column(df, "precipitation_mm")
        threshold = max(30.0, float(values.quantile(0.99)))
        condition = values >= threshold
        unit, threshold_label = "mm/day", "maximum of 30 mm/day and the 99th precipitation percentile"

    elif hazard == "strong_winds":
        speed = _column(df, "wind_speed_kmh")
        gust = _column(df, "wind_gust_kmh")
        values = pd.concat([speed, gust], axis=1).max(axis=1, skipna=True)
        threshold = 50.0
        condition = values >= threshold
        unit, threshold_label = "km/h", "50 km/h maximum wind speed or gust proxy"

    elif hazard == "frost":
        values = _column(df, "tmin")
        threshold = 0.0
        condition = values <= threshold
        unit, threshold_label = "°C", "daily minimum temperature at or below 0 °C"

    elif hazard == "drought":
        precipitation = _column(df, "precipitation_mm")
        rolling = precipitation.rolling(window=90, min_periods=75).sum()
        valid = rolling.dropna()
        if valid.empty:
            raise ValueError("Not enough precipitation history to calculate 90-day drought indicators.")
        threshold = float(valid.quantile(0.20))
        values = rolling
        condition = rolling <= threshold
        min_days = 30
        unit, threshold_label = "mm/90 days", "20th percentile of rolling 90-day precipitation totals"
        direction = "low"
        notes.append(
            "This is a precipitation-deficit indicator, not a full drought assessment; "
            "soil moisture, evapotranspiration and local drought indices improve reliability."
        )

    elif hazard == "flood":
        values = _column(df, "precipitation_mm")
        threshold = max(50.0, float(values.quantile(0.99)))
        condition = values >= threshold
        unit, threshold_label = "mm/day", "heavy-rainfall proxy for potential flood conditions"
        notes.append(
            "Potential flood conditions only. This does not confirm a flood; river levels, "
            "terrain, drainage and observed inundation data are needed."
        )

    elif hazard == "wildfire":
        tmax = _column(df, "tmax")
        precipitation = _column(df, "precipitation_mm")
        wind = _column(df, "wind_speed_kmh")
        threshold = float(tmax.quantile(0.90))
        values = tmax
        condition = (tmax >= threshold) & (precipitation <= 1.0) & (wind >= 25.0)
        min_days = 3
        unit, threshold_label = "°C", "hot, dry and windy weather proxy"
        notes.append(
            "This estimates weather favorable to fire danger, not actual wildfire occurrence. "
            "Fuel moisture, vegetation and fire-observation data are needed for fire detection."
        )

    else:  # thunderstorm
        raise NotImplementedError(
            "Thunderstorm detection is not implemented with daily temperature, "
            "precipitation and wind data alone. Add lightning/storm observations or "
            "suitable atmospheric instability variables before enabling this detector."
        )

    events = _contiguous_events(
        df,
        condition,
        values,
        hazard=hazard,
        threshold=threshold,
        unit=unit,
        min_days=min_days,
        direction=direction,
    )

    yearly = _yearly_stats(events, first_year, last_year)
    return {
        "hazard": hazard,
        "threshold_value": round(float(threshold), 2),
        "threshold_label": threshold_label,
        "unit": unit,
        "events": events,
        "yearly_stats": yearly,
        "notes": notes,
    }


# Backward-compatible helpers for code that still imports the original names.
def detect_heatwaves(
    df: pd.DataFrame,
    percentile: int = 95,
    min_consecutive_days: int = 3,
):
    """Legacy heatwave helper returning (threshold, event dictionaries)."""
    values = _column(df, "tmax")
    threshold = float(values.quantile(percentile / 100))
    condition = values >= threshold
    events = _contiguous_events(
        df,
        condition,
        values,
        hazard="heatwave",
        threshold=threshold,
        unit="°C",
        min_days=min_consecutive_days,
        direction="high",
    )
    return threshold, events


def compute_yearly_stats(events, start_year: int, end_year: int):
    """Legacy name; now returns hazard-neutral yearly dictionaries."""
    normalized = []
    for event in events:
        if isinstance(event, dict):
            normalized.append(event)
        else:
            normalized.append({
                "year": event.year,
                "duration_days": event.duration_days,
                "peak_value": getattr(event, "max_temp", 0.0),
                "mean_value": getattr(event, "mean_excess", 0.0),
            })
    generic = _yearly_stats(normalized, start_year, end_year)
    # Preserve the original response schema for the existing heatwave route.
    return [
        {
            "year": row["year"],
            "event_count": row["event_count"],
            "total_duration_days": row["total_duration_days"],
            "mean_intensity": row["mean_intensity"],
            "max_temp_recorded": row["max_value_recorded"] if row["max_value_recorded"] is not None else 0.0,
            "longest_event_days": row["longest_event_days"],
        }
        for row in generic
    ]
