"""
Cache service: MongoDB TTL cache with disk cache fallback.
Caches heavy API fetch + analysis results to avoid repeated Open-Meteo calls.
"""
import json
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import diskcache

from config import settings

logger = logging.getLogger(__name__)

# Disk cache as primary fallback when MongoDB is unavailable
_disk_cache = diskcache.Cache(settings.disk_cache_path)


def _make_key(params: dict) -> str:
    """Create a deterministic cache key from request parameters."""
    canonical = json.dumps(params, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


async def get_cached(params: dict) -> Optional[Any]:
    """Retrieve cached analysis result. Tries MongoDB first, then disk."""
    key = _make_key(params)

    # Try MongoDB
    try:
        from db.mongodb import get_collection
        collection = get_collection("cache")
        if collection is not None:
            doc = await collection.find_one({"cache_key": key})
            if doc:
                logger.info(f"Cache HIT (MongoDB) for key {key[:8]}...")
                return doc["data"]
    except Exception as e:
        logger.warning(f"MongoDB cache read failed: {e}")

    # Try disk cache
    if key in _disk_cache:
        logger.info(f"Cache HIT (disk) for key {key[:8]}...")
        return _disk_cache[key]

    logger.info(f"Cache MISS for key {key[:8]}...")
    return None


async def set_cached(params: dict, data: Any, ttl_days: int = None) -> None:
    """Store analysis result in cache (MongoDB + disk)."""
    key = _make_key(params)
    ttl = ttl_days or settings.cache_ttl_days
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl)

    # Try MongoDB
    try:
        from db.mongodb import get_collection
        collection = get_collection("cache")
        if collection is not None:
            await collection.update_one(
                {"cache_key": key},
                {"$set": {"cache_key": key, "data": data, "expires_at": expires_at,
                           "created_at": datetime.now(timezone.utc), "params": params}},
                upsert=True,
            )
            logger.info(f"Cached to MongoDB (key {key[:8]}..., TTL {ttl}d)")
    except Exception as e:
        logger.warning(f"MongoDB cache write failed: {e}")

    # Always write to disk cache as backup
    _disk_cache.set(key, data, expire=ttl * 86400)
    logger.info(f"Cached to disk (key {key[:8]}...)")
