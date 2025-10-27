# app/utils/redis_client.py
import redis.asyncio as redis
import logging
import json
import hashlib
import datetime
import asyncio # Import asyncio for sleep
from app.config import settings
from typing import Dict, Optional, List, Any

logger = logging.getLogger(__name__)

# Connection Pool (initialized during startup)
redis_pool = None

async def init_redis_pool(retries=5, delay=3):
    """
    Initializes the Redis connection pool with a retry mechanism.
    """
    global redis_pool
    if redis_pool:
        logger.info("Redis pool already initialized.")
        return

    password = getattr(settings, 'redis_password', None)
    
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Attempting to connect to Redis ({attempt}/{retries})...")
            pool = redis.ConnectionPool(
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
                password=password,
                decode_responses=True,
                max_connections=20
            )
            # Try a ping to confirm connection
            async with redis.Redis(connection_pool=pool) as r:
                await r.ping()
            
            # If ping is successful, set the global pool and exit
            redis_pool = pool
            logger.info(f"Redis connection pool initialized for {settings.redis_host}:{settings.redis_port}")
            return # Success
            
        except Exception as e:
            logger.warning(f"Redis connection attempt {attempt} failed: {e}")
            if attempt < retries:
                logger.info(f"Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Failed to initialize Redis connection pool after {retries} attempts.")
                redis_pool = None # Ensure pool is None if all attempts fail

async def close_redis_pool():
    """Closes the Redis connection pool."""
    global redis_pool
    if redis_pool:
        try:
            await redis_pool.disconnect(inuse_connections=True)
            logger.info("Redis connection pool closed.")
        except Exception as e:
            logger.error(f"Error closing Redis pool: {e}")
        finally:
            redis_pool = None

def get_redis_key_for_incident(short_desc: str, desc: Optional[str]) -> str:
    """Generates a consistent cache key from incident descriptions."""
    full_text = f"{short_desc or ''}::{desc or ''}".strip().lower()
    hash_object = hashlib.sha256(full_text.encode())
    hex_dig = hash_object.hexdigest()
    return f"feedback:desc_hash:{hex_dig[:16]}"

async def update_feedback_summary(
    redis_key: str,
    feedback_type: str, # 'Correct' or 'Incorrect'
    agent_id: Optional[str],
    ttl_seconds: int = 60 * 60 * 24 * 7 # 7 days
) -> None:
    """Updates feedback counts and TTL in a Redis Hash."""
    if not redis_pool:
        logger.warning(f"Redis pool not initialized. Skipping feedback cache update for key: {redis_key}")
        return

    try:
        async with redis.Redis(connection_pool=redis_pool) as r:
            pipe = r.pipeline()
            
            if feedback_type == 'Correct':
                pipe.hincrby(redis_key, "correct_count", 1)
                if agent_id:
                    pipe.hincrby(redis_key, f"correct_agent:{agent_id}", 1)
            elif feedback_type == 'Incorrect':
                pipe.hincrby(redis_key, "incorrect_count", 1)
                if agent_id:
                     pipe.hincrby(redis_key, f"incorrect_recommendation:{agent_id}", 1)

            pipe.hset(redis_key, "last_feedback_ts", datetime.datetime.utcnow().isoformat())
            pipe.expire(redis_key, ttl_seconds)

            results = await pipe.execute()
            logger.info(f"Updated Redis feedback summary for key '{redis_key}'. Type: {feedback_type}, Agent: {agent_id}.")
    except Exception as e:
        logger.error(f"Error updating Redis feedback summary for key '{redis_key}': {e}", exc_info=True)

async def get_feedback_summary(redis_key: str) -> Optional[Dict[str, Any]]:
    """Retrieves the feedback summary hash from Redis."""
    if not redis_pool:
        logger.warning(f"Redis pool not initialized. Cannot get feedback summary for key: {redis_key}")
        return None
    try:
        async with redis.Redis(connection_pool=redis_pool) as r:
            summary_str_dict: Dict[str, str] = await r.hgetall(redis_key)
            if summary_str_dict:
                logger.debug(f"Retrieved Redis feedback summary for key '{redis_key}': {summary_str_dict}")
                numeric_summary: Dict[str, Any] = {}
                for k, v in summary_str_dict.items():
                    is_counter = (
                        k.endswith('_count') or
                        k.startswith('correct_agent:') or
                        k.startswith('incorrect_recommendation:')
                    )
                    if is_counter:
                         try:
                            numeric_summary[k] = int(v)
                         except (ValueError, TypeError):
                             logger.warning(f"Could not convert Redis value '{v}' to int for key '{k}'. Defaulting to 0.")
                             numeric_summary[k] = 0
                    else:
                        numeric_summary[k] = v
                return numeric_summary
            else:
                logger.debug(f"No Redis feedback summary found for key '{redis_key}'.")
                return None
    except Exception as e:
        logger.error(f"Error getting Redis feedback summary for key '{redis_key}': {e}", exc_info=True)
        return None

