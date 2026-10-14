# """
# Trend analysis service: Computes statistical trends in heatwave frequency.

# Methods:
#   1. Linear regression (scipy.stats.linregress) — slope, R², p-value
#   2. Mann-Kendall test (pymannkendall) — non-parametric monotonic trend detection
#   3. 5-year rolling average — smoothed time series for visualization
#   4. Percent change — early period vs. late period average comparison

# Mann-Kendall is preferred for climate data because temperature trends are
# often non-linear and MK doesn't assume a normal distribution.
# """
# import logging
# from typing import List, Tuple
# import numpy as np
# from scipy import stats
# import pymannkendall as mk
# from models.schemas import YearlyStats, TrendResult, InsightSummary

# logger = logging.getLogger(__name__)


# def compute_trend(yearly_stats: List[YearlyStats]) -> Tuple[TrendResult, List[dict]]:
#     """
#     Compute linear regression + Mann-Kendall trend on annual event counts.
#     Also returns 5-year rolling average.
#     """
#     years = np.array([s.year for s in yearly_stats])
#     counts = np.array([s.event_count for s in yearly_stats], dtype=float)

#     # ── Linear regression ──────────────────────────────────────────────────────
#     slope, intercept, r_value, p_value, std_err = stats.linregress(years, counts)
#     r_squared = r_value ** 2

#     # ── Mann-Kendall test ──────────────────────────────────────────────────────
#     mk_result = mk.original_test(counts)
#     mk_trend = mk_result.trend          # "increasing" | "decreasing" | "no trend"
#     mk_p = mk_result.p

#     # ── Percent change (first 5yr avg → last 5yr avg) ─────────────────────────
#     n = len(counts)
#     if n >= 10:
#         early_avg = counts[:5].mean()
#         late_avg = counts[-5:].mean()
#         if early_avg > 0:
#             pct_change = ((late_avg - early_avg) / early_avg) * 100
#         else:
#             pct_change = float("inf") if late_avg > 0 else 0.0
#     else:
#         pct_change = 0.0

#     # ── Trend direction ────────────────────────────────────────────────────────
#     if p_value < 0.05:
#         trend_direction = "increasing" if slope > 0 else "decreasing"
#     else:
#         trend_direction = "no trend"

#     trend = TrendResult(
#         slope=round(float(slope), 4),
#         intercept=round(float(intercept), 4),
#         r_squared=round(float(r_squared), 4),
#         p_value=round(float(p_value), 4),
#         trend_direction=trend_direction,
#         mann_kendall_trend=mk_trend,
#         mann_kendall_p=round(float(mk_p), 4),
#         percent_change=round(float(pct_change), 1),
#     )

#     # ── 5-year rolling average ─────────────────────────────────────────────────
#     rolling = []
#     for i in range(len(years)):
#         window = counts[max(0, i - 2): i + 3]  # centered ±2 years
#         rolling.append({
#             "year": int(years[i]),
#             "avg_events": round(float(window.mean()), 2),
#             "raw_events": int(counts[i]),
#             "regression_fit": round(float(slope * years[i] + intercept), 2),
#         })

#     logger.info(f"Trend: slope={slope:.3f}, p={p_value:.4f}, MK={mk_trend} (p={mk_p:.4f})")
#     return trend, rolling


# def generate_insights(
#     trend: TrendResult,
#     yearly_stats: List[YearlyStats],
#     region_name: str,
#     threshold_temp: float,
# ) -> InsightSummary:
#     """
#     Generate human-readable insight summary from trend results.
#     Honest about uncertainty (p-value, effect size).
#     """
#     details = []
#     total_events = sum(s.event_count for s in yearly_stats)
#     years_span = yearly_stats[-1].year - yearly_stats[0].year + 1
#     avg_per_year = total_events / years_span

#     # Trend statement
#     sig = trend.p_value < 0.05
#     mk_sig = trend.mann_kendall_p < 0.05

#     if trend.percent_change != 0 and (sig or mk_sig):
#         direction = "increased" if trend.percent_change > 0 else "decreased"
#         headline = (
#             f"Heatwaves have {direction} by {abs(trend.percent_change):.0f}% "
#             f"in {region_name} since {yearly_stats[0].year}"
#         )
#     elif avg_per_year < 0.5:
#         headline = f"Heatwaves are rare in {region_name} ({avg_per_year:.1f} events/year on average)"
#     else:
#         headline = (
#             f"No statistically significant trend detected in {region_name} "
#             f"(p={trend.p_value:.2f}). Heatwaves average {avg_per_year:.1f}/year."
#         )

#     # Linear regression detail
#     if sig:
#         details.append(
#             f"Linear regression shows {abs(trend.slope):.2f} additional heatwave events per year "
#             f"(R²={trend.r_squared:.2f}, p={trend.p_value:.3f})."
#         )
#     else:
#         details.append(
#             f"Linear regression trend is not statistically significant "
#             f"(slope={trend.slope:.2f} events/yr, p={trend.p_value:.3f})."
#         )

#     # Mann-Kendall
#     details.append(
#         f"Mann-Kendall test: '{trend.mann_kendall_trend}' trend "
#         f"(p={trend.mann_kendall_p:.3f})."
#     )

#     # Threshold context
#     details.append(
#         f"Heatwave threshold: {threshold_temp:.1f}°C (95th percentile of historical daily maxima)."
#     )

#     # Worst year
#     worst = max(yearly_stats, key=lambda s: s.event_count)
#     if worst.event_count > 0:
#         details.append(
#             f"Peak year: {worst.year} with {worst.event_count} heatwave events "
#             f"({worst.total_duration_days} total hot days)."
#         )

#     # Best consecutive decade
#     if len(yearly_stats) >= 10:
#         decade_counts = [
#             (yearly_stats[i].year, sum(s.event_count for s in yearly_stats[i:i+10]))
#             for i in range(len(yearly_stats) - 9)
#         ]
#         worst_decade = max(decade_counts, key=lambda x: x[1])
#         details.append(
#             f"Hottest decade: {worst_decade[0]}–{worst_decade[0]+9} "
#             f"with {worst_decade[1]} heatwave events."
#         )

#     # Severity classification
#     pct = abs(trend.percent_change)
#     if pct >= 100 and (sig or mk_sig):
#         severity = "severe"
#     elif pct >= 50 and (sig or mk_sig):
#         severity = "high"
#     elif pct >= 20 and sig:
#         severity = "moderate"
#     else:
#         severity = "low"

#     return InsightSummary(headline=headline, details=details, severity=severity)








"""
Hazard-neutral trend analysis service.

Computes trends in annual event counts for whichever hazard detector produced
the yearly statistics. Statistical methods are unchanged in spirit:
linear regression, Mann-Kendall, a centered 5-year rolling mean, and early/late
period percent change.
"""
import logging
import math
from typing import List, Tuple

import numpy as np
from scipy import stats
import pymannkendall as mk

from models.schemas import YearlyStats, TrendResult, InsightSummary

logger = logging.getLogger(__name__)


def _safe_float(value: float, digits: int = 4) -> float:
    """Round finite numbers and prevent NaN/Infinity from breaking JSON."""
    value = float(value)
    return round(value, digits) if math.isfinite(value) else 0.0


def compute_trend(
    yearly_stats: List[YearlyStats],
) -> Tuple[TrendResult, List[dict]]:
    """
    Compute trend statistics on yearly event counts and return rolling averages.

    A valid analysis needs at least two distinct years. For constant event
    counts, scipy can return an undefined correlation; that case is handled.
    """
    if len(yearly_stats) < 2:
        raise ValueError("At least two years of yearly statistics are required.")

    yearly_stats = sorted(yearly_stats, key=lambda item: item.year)
    years = np.array([item.year for item in yearly_stats], dtype=float)
    counts = np.array([item.event_count for item in yearly_stats], dtype=float)

    if not np.isfinite(counts).all():
        raise ValueError("Yearly event counts contain invalid numeric values.")

    regression = stats.linregress(years, counts)
    slope = float(regression.slope)
    intercept = float(regression.intercept)
    p_value = float(regression.pvalue)
    r_value = float(regression.rvalue) if math.isfinite(float(regression.rvalue)) else 0.0
    r_squared = r_value ** 2

    try:
        mk_result = mk.original_test(counts)
        mk_trend = str(mk_result.trend)
        mk_p = float(mk_result.p)
    except Exception as exc:
        logger.warning("Mann-Kendall test could not be computed: %s", exc)
        mk_trend = "no trend"
        mk_p = 1.0

    n = len(counts)
    if n >= 10:
        early_avg = float(counts[:5].mean())
        late_avg = float(counts[-5:].mean())
        if early_avg > 0:
            pct_change = ((late_avg - early_avg) / early_avg) * 100.0
        elif late_avg > 0:
            # Percent change from zero is mathematically undefined. Use zero
            # here rather than Infinity, and let the absolute trend statistics
            # describe the change.
            pct_change = 0.0
        else:
            pct_change = 0.0
    else:
        pct_change = 0.0

    if p_value < 0.05:
        trend_direction = "increasing" if slope > 0 else "decreasing" if slope < 0 else "no trend"
    else:
        trend_direction = "no trend"

    trend = TrendResult(
        slope=_safe_float(slope),
        intercept=_safe_float(intercept),
        r_squared=_safe_float(r_squared),
        p_value=_safe_float(p_value),
        trend_direction=trend_direction,
        mann_kendall_trend=mk_trend,
        mann_kendall_p=_safe_float(mk_p),
        percent_change=_safe_float(pct_change, 1),
    )

    rolling = []
    for i, year in enumerate(years):
        start = max(0, i - 2)
        stop = min(len(counts), i + 3)
        window = counts[start:stop]
        rolling.append({
            "year": int(year),
            "avg_events": round(float(window.mean()), 2),
            "raw_events": int(counts[i]),
            "regression_fit": round(float(slope * year + intercept), 2),
        })

    logger.info(
        "Trend: slope=%.3f, p=%.4f, MK=%s (p=%.4f)",
        slope, p_value, mk_trend, mk_p,
    )
    return trend, rolling


def generate_insights(
    trend: TrendResult,
    yearly_stats: List[YearlyStats],
    region_name: str,
    threshold_temp: float,
    hazard: str = "heatwave",
    threshold_label: str | None = None,
    threshold_unit: str | None = None,
) -> InsightSummary:
    """Generate hazard-aware, cautious insights from annual event statistics."""
    if not yearly_stats:
        return InsightSummary(
            headline=f"No yearly results are available for {region_name}.",
            details=["The selected period did not produce yearly statistics."],
            severity="low",
        )

    yearly_stats = sorted(yearly_stats, key=lambda item: item.year)
    labels = {
        "heatwave": ("heatwave", "heatwaves"),
        "cold_wave": ("cold-wave event", "cold waves"),
        "heavy_rainfall": ("heavy-rainfall event", "heavy-rainfall events"),
        "drought": ("drought-indicator event", "drought indicators"),
        "flood": ("potential-flood rainfall event", "potential flood conditions"),
        "strong_winds": ("strong-wind event", "strong-wind events"),
        "wildfire": ("fire-weather event", "fire-weather conditions"),
        "thunderstorm": ("thunderstorm event", "thunderstorms"),
        "extreme_precipitation": ("extreme-precipitation event", "extreme-precipitation events"),
        "frost": ("frost day/event", "frost events"),
    }
    singular, plural = labels.get(hazard, (hazard.replace("_", " "), hazard.replace("_", " ") + " events"))

    total_events = sum(item.event_count for item in yearly_stats)
    years_span = yearly_stats[-1].year - yearly_stats[0].year + 1
    avg_per_year = total_events / max(years_span, 1)
    sig = trend.p_value < 0.05
    mk_sig = trend.mann_kendall_p < 0.05

    if (sig or mk_sig) and trend.percent_change != 0:
        direction = "increased" if trend.percent_change > 0 else "decreased"
        headline = (
            f"{plural.capitalize()} have {direction} by "
            f"{abs(trend.percent_change):.0f}% in {region_name} "
            f"across the analyzed period."
        )
    elif avg_per_year < 0.5:
        headline = f"{plural.capitalize()} are infrequent in {region_name} ({avg_per_year:.1f} events/year on average)."
    else:
        headline = (
            f"No statistically significant trend detected for {plural} in {region_name} "
            f"(linear-regression p={trend.p_value:.2f}); the average is {avg_per_year:.1f} events/year."
        )

    details: list[str] = []
    if sig:
        details.append(
            f"Linear regression indicates a statistically significant change of "
            f"{trend.slope:.2f} events per year (R²={trend.r_squared:.2f}, p={trend.p_value:.3f})."
        )
    else:
        details.append(
            f"Linear regression is not statistically significant "
            f"(slope={trend.slope:.2f} events/year, p={trend.p_value:.3f})."
        )

    details.append(
        f"Mann-Kendall test: '{trend.mann_kendall_trend}' monotonic trend "
        f"(p={trend.mann_kendall_p:.3f})."
    )

    if threshold_label:
        unit = f" {threshold_unit}" if threshold_unit else ""
        details.append(f"Detection threshold: {threshold_label} ({threshold_temp:.2f}{unit}).")
    else:
        details.append(f"Detection threshold value: {threshold_temp:.2f}.")

    worst = max(yearly_stats, key=lambda item: item.event_count)
    if worst.event_count > 0:
        details.append(
            f"Peak year: {worst.year}, with {worst.event_count} {singular} "
            f"and {worst.total_duration_days} total event days."
        )

    if len(yearly_stats) >= 10:
        decade_counts = [
            (yearly_stats[i].year, sum(item.event_count for item in yearly_stats[i:i + 10]))
            for i in range(len(yearly_stats) - 9)
        ]
        peak_decade = max(decade_counts, key=lambda item: item[1])
        details.append(
            f"Highest-count 10-year window: {peak_decade[0]}–{peak_decade[0] + 9}, "
            f"with {peak_decade[1]} detected events."
        )

    pct = abs(trend.percent_change)
    if pct >= 100 and (sig or mk_sig):
        severity = "severe"
    elif pct >= 50 and (sig or mk_sig):
        severity = "high"
    elif pct >= 20 and sig:
        severity = "moderate"
    else:
        severity = "low"

    return InsightSummary(headline=headline, details=details, severity=severity)
