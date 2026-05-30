import asyncio

from app.db.database import async_session_maker
from app.db.redis import get_redis
from app.services.siata_sync import SiataSyncService, StaticSeedSiataClient
from app.services.telemetry import flush_telemetry
from app.tasks.celery_app import celery_app


async def _run_sync() -> int:
    async with async_session_maker() as db:
        return await SiataSyncService(StaticSeedSiataClient()).sync(db)


@celery_app.task(name="siata.sync_flood_hazards")
def sync_siata_flood_hazards() -> int:
    """Sincroniza los niveles de las estaciones SIATA con flood_hazards."""
    return asyncio.run(_run_sync())


async def _run_flush() -> int:
    async with async_session_maker() as db:
        return await flush_telemetry(db, get_redis())


@celery_app.task(name="telemetry.flush")
def flush_telemetry_task() -> int:
    """Drena el buffer de telemetría de Redis hacia Postgres en lotes."""
    return asyncio.run(_run_flush())
