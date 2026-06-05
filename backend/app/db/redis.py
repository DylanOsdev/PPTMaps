import asyncio
import logging

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=3,
            retry_on_timeout=False,
            health_check_interval=30,
        )
    return _redis


async def check_redis_ready(timeout: float = 2.0) -> bool:
    try:
        r = get_redis()
        await asyncio.wait_for(r.ping(), timeout=timeout)
        return True
    except Exception as e:
        logger.warning("Redis no disponible: %s", e)
        return False
