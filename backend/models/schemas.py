"""
Pydantic models for API request/response validation.
The response models support multiple hazard types while retaining legacy
heatwave fields for compatibility with existing clients and export code.
"""
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


class HazardType(str, Enum):
    heatwave = "heatwave"
    cold_wave = "cold_wave"
    heavy_rainfall = "heavy_rainfall"
    drought = "drought"
    flood = "flood"
    strong_winds = "strong_winds"
    wildfire = "wildfire"
    thunderstorm = "thunderstorm"
    extreme_precipitation = "extreme_precipitation"
    frost = "frost"


class AnalyzeRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude of region center")
    lon: float = Field(..., ge=-180, le=180, description="Longitude of region center")
    # Year bounds are kept consistent with the current API until the year-range
    # work is handled separately, as requested.
    start_year: int = Field(..., ge=1950, le=2023, description="Start year")
    end_year: int = Field(..., ge=1950, le=2023, description="End year")
    hazard: HazardType = HazardType.heatwave
    region_name: Optional[str] = Field(None, max_length=100)

    @field_validator("end_year")
    @classmethod
    def end_after_start(cls, value, info):
        start_year = info.data.get("start_year")
        if start_year is not None and value <= start_year:
            raise ValueError("end_year must be greater than start_year")
        if start_year is not None and value - start_year < 4:
            raise ValueError(
                "Date range must be at least 5 years for meaningful trend analysis"
            )
        return value


class HeatwaveEvent(BaseModel):
    year: int
    start_date: str
    end_date: str
    duration_days: int
    max_temp: float
    mean_excess: float


class YearlyStats(BaseModel):
    year: int
    event_count: int
    total_duration_days: int
    mean_intensity: float
    # Generic maximum for all hazard types.
    max_value_recorded: Optional[float] = None
    # Legacy heatwave field retained so older consumers do not immediately break.
    max_temp_recorded: Optional[float] = None
    longest_event_days: int


class TrendResult(BaseModel):
    slope: float
    intercept: float
    r_squared: float
    p_value: float
    trend_direction: str
    mann_kendall_trend: str
    mann_kendall_p: float
    percent_change: float


class InsightSummary(BaseModel):
    headline: str
    details: List[str]
    severity: str


class AnalyzeResponse(BaseModel):
    region_name: str
    lat: float
    lon: float
    start_year: int
    end_year: int
    hazard: str
    # Legacy name retained for API compatibility; threshold_label/unit clarify
    # what the number means for non-temperature hazards.
    threshold_temp: float
    threshold_label: Optional[str] = None
    threshold_unit: Optional[str] = None
    yearly_stats: List[YearlyStats]
    trend: TrendResult
    insights: InsightSummary
    rolling_avg_5yr: List[dict[str, Any]]
    data_quality: dict[str, Any]
    cached: bool = False


class GeocodingResult(BaseModel):
    name: str
    lat: float
    lon: float
    country: str
    admin1: Optional[str] = None
