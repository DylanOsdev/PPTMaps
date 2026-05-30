import asyncio

from app.db.database import async_session_maker
from app.services.siata_sync import SiataSyncService, StaticSeedSiataClient
from app.tasks.celery_app import celery_app


async def _run_sync() -> int:
    async with async_session_maker() as db:
        return await SiataSyncService(StaticSeedSiataClient()).sync(db)


@celery_app.task(name="siata.sync_flood_hazards")
def sync_siata_flood_hazards() -> int:
    """Sincroniza los niveles de las estaciones SIATA con flood_hazards."""
    return asyncio.run(_run_sync())
