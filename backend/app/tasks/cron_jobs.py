import asyncio

from app.db.database import async_session_maker
from app.db.redis import get_redis
from app.services.siata_sync import SiataSyncService, _create_siata_client
from app.services.telemetry import flush_telemetry
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


async def _run_flush() -> int:
    from redis.asyncio import Redis
    from app.core.config import settings
    
    redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        async with async_session_maker() as db:
            result = await flush_telemetry(db, redis)
        return result
    finally:
        await redis.aclose()


@celery_app.task(name="telemetry.flush")
def flush_telemetry_task() -> int:
    """Drena el buffer de telemetría de Redis hacia Postgres en lotes."""
    return asyncio.run(_run_flush())


async def _run_clustering() -> int:
    from app.ml.dbscan_clustering import cluster_accident_hotspots

    async with async_session_maker() as db:
        return await cluster_accident_hotspots(db)


@celery_app.task(name="ml.cluster_accident_hotspots")
def cluster_accident_hotspots_task() -> int:
    """Reclustriza los accidentes (DBSCAN) y refresca las zonas calientes."""
    return asyncio.run(_run_clustering())


async def _run_weather_alerts() -> int:
    from app.services.weather_alerts import generate_weather_alerts

    async with async_session_maker() as db:
        return await generate_weather_alerts(db)


@celery_app.task(name="weather.generate_alerts")
def generate_weather_alerts_task() -> int:
    """Analiza weather snapshots y genera alertas meteorológicas automáticas."""
    return asyncio.run(_run_weather_alerts())


async def _run_cache_predictions() -> int:
    """Cachea predicciones ML en Redis para respuesta rápida."""
    import json
    from redis.asyncio import Redis
    from app.core.config import settings
    from app.services.traffic_prediction import get_prediction_service
    
    redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        async with async_session_maker() as db:
            service = get_prediction_service()
            predictions = await service.predict_current(db)
            
            # Guardar en Redis con TTL 15 min
            cache_data = {
                "predictions": predictions,
                "model": "XGBoost",
                "features": ["hora", "dia_semana", "mes", "comuna", "lat", "lng", "gravedad"],
                "training_examples": 6489,
                "cached_at": predictions[0]["timestamp"] if predictions else None
            }
            
            await redis.setex(
                "ml:traffic_predictions",
                900,  # 15 minutos
                json.dumps(cache_data)
            )
            
            return len(predictions)
    finally:
        await redis.aclose()


@celery_app.task(name="ml.cache_predictions")
def cache_traffic_predictions_task() -> int:
    """Cachea predicciones ML de congestión en Redis cada 15 minutos."""
    return asyncio.run(_run_cache_predictions())
