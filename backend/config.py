"""
Configuration settings for the Climate Hazard Trend Analyzer backend.
Uses pydantic-settings to load from environment variables / .env file.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    db_name: str = "climate_hazard"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Cache
    cache_ttl_days: int = 7
    disk_cache_path: str = "./cache_store"

    # Rate limiting
    rate_limit: str = "30/minute"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
