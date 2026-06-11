import asyncio

from app.db.database import async_session_maker
from app.db.redis import get_redis
from app.services.siata_sync import SiataSyncService, _create_siata_client
from app.services.air_quality_sync import AirQualitySyncService, _create_air_quality_client
from app.tasks.celery_app import celery_app


async def _run_sync() -> int:
    async with async_session_maker() as db:
        client = await _create_siata_client()
        return await SiataSyncService(client).sync(db)


@celery_app.task(name="siata.sync_flood_hazards")
def sync_siata_flood_hazards() -> int:
    """Sincroniza los niveles de las estaciones SIATA con flood_hazards."""
    return asyncio.run(_run_sync())


async def _run_weather_sync() -> int:
    from app.services.weather import OpenMeteoClient, WeatherSyncService

    async with async_session_maker() as db:
        return await WeatherSyncService(OpenMeteoClient()).sync(db)


@celery_app.task(name="weather.sync")
def sync_weather() -> int:
    """Sincroniza el clima/lluvia del Valle de Aburrá (Open-Meteo) con weather_snapshots."""
    return asyncio.run(_run_weather_sync())


async def _run_weather_alerts() -> int:
    from app.services.weather_alerts import generate_weather_alerts

    async with async_session_maker() as db:
        return await generate_weather_alerts(db)


@celery_app.task(name="weather.generate_alerts")
def generate_weather_alerts_task() -> int:
    """Analiza weather snapshots y genera alertas meteorológicas automáticas."""
    return asyncio.run(_run_weather_alerts())


async def _run_air_quality_sync() -> int:
    """Ejecuta sync de calidad del aire."""
    async with async_session_maker() as db:
        client = await _create_air_quality_client()
        return await AirQualitySyncService(client).sync(db)


@celery_app.task(name="air_quality.sync")
def sync_air_quality() -> int:
    """Sincroniza datos de calidad del aire (WAQI API) con air_quality_readings."""
    return asyncio.run(_run_air_quality_sync())
