"""
MongoDB client setup using Motor (async driver).
Provides a singleton database instance and collection helpers.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


async def connect_db():
    """Initialize the MongoDB connection."""
    global _client
    try:
        _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        # Verify connection
        await _client.admin.command("ping")
        logger.info("[OK] Connected to MongoDB successfully")
        # Create TTL index on cache collection
        db = _client[settings.db_name]
        await db["cache"].create_index("expires_at", expireAfterSeconds=0)
        await db["cache"].create_index("cache_key", unique=True)
        logger.info("[OK] MongoDB indexes created")
    except Exception as e:
        logger.warning(f"[WARN] MongoDB connection failed: {e}. Falling back to disk cache.")
        _client = None


async def close_db():
    """Close the MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None


def get_db():
    """Get the database instance. Returns None if not connected."""
    if _client is None:
        return None
    return _client[settings.db_name]


def get_collection(name: str):
    """Get a MongoDB collection by name."""
    db = get_db()
    if db is None:
        return None
    return db[name]
