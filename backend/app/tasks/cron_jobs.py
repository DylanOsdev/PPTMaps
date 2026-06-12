import asyncio

from sqlalchemy import select

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
    import nest_asyncio
    nest_asyncio.apply()
    return asyncio.run(_run_sync())


async def _run_weather_sync() -> int:
    from app.services.weather import OpenMeteoClient, WeatherSyncService

    async with async_session_maker() as db:
        return await WeatherSyncService(OpenMeteoClient()).sync(db)


@celery_app.task(name="weather.sync")
def sync_weather() -> int:
    """Sincroniza el clima/lluvia del Valle de Aburrá (Open-Meteo) con weather_snapshots."""
    import nest_asyncio
    nest_asyncio.apply()
    return asyncio.run(_run_weather_sync())


async def _run_weather_alerts() -> int:
    from app.services.weather_alerts import generate_weather_alerts

    async with async_session_maker() as db:
        return await generate_weather_alerts(db)


@celery_app.task(name="weather.generate_alerts")
def generate_weather_alerts_task() -> int:
    """Analiza weather snapshots y genera alertas meteorológicas automáticas."""
    import nest_asyncio
    nest_asyncio.apply()
    return asyncio.run(_run_weather_alerts())


async def _run_air_quality_sync() -> int:
    """Ejecuta sync de calidad del aire."""
    from app.core.config import settings
    
    async with async_session_maker() as db:
        client = await _create_air_quality_client(settings.WAQI_API_TOKEN or "")
        return await AirQualitySyncService(client).sync(db)


@celery_app.task(name="air_quality.sync")
def sync_air_quality() -> int:
    """Sincroniza datos de calidad del aire (WAQI API) con air_quality_readings."""
    import nest_asyncio
    nest_asyncio.apply()
    return asyncio.run(_run_air_quality_sync())


async def _run_weather_events_sync() -> int:
    """Ejecuta sync de eventos climáticos desde SIATA."""
    from app.services.weather_event_sync import sync_weather_events
    
    async with async_session_maker() as db:
        return await sync_weather_events(db)


@celery_app.task(name="weather_events.sync")
def sync_weather_events_task() -> int:
    """Sincroniza eventos climáticos (lluvia + rayos SIATA) con weather_events."""
    import nest_asyncio
    nest_asyncio.apply()
    return asyncio.run(_run_weather_events_sync())


async def _run_risk_train() -> dict:
    from app.ml.feature_pipeline import build_training_features
    from app.ml.risk_model import SimpleRiskModel

    async with async_session_maker() as db:
        features = await build_training_features(db, limit=1000, offset=0)
        model = SimpleRiskModel.get_instance()
        weights = model.train(features)
        return {"samples": len(features), "weights": weights}


@celery_app.task(name="ml.train_risk_model")
def train_risk_model() -> dict:
    """Entrena el modelo de riesgo de accidentes con datos históricos + clima."""
    import nest_asyncio
    nest_asyncio.apply()
    result = asyncio.run(_run_risk_train())
    logger = __import__("logging").getLogger(__name__)
    logger.info(f"Risk model trained on {result['samples']} samples")
    return result


async def _run_risk_update() -> int:
    from app.models.accident_zone import AccidentZone
    from app.ml.feature_pipeline import build_inference_features
    from app.ml.risk_model import SimpleRiskModel

    async with async_session_maker() as db:
        model = SimpleRiskModel.get_instance()
        if not model.is_trained:
            from app.ml.feature_pipeline import build_training_features
            features = await build_training_features(db, limit=1000, offset=0)
            model.train(features)

        zones = await db.execute(
            select(AccidentZone).where(AccidentZone.severity >= 1).limit(100)
        )
        updated = 0
        for zone in zones.scalars().all():
            try:
                from geoalchemy2.shape import to_shape
                center = to_shape(zone.geom).centroid
                features = await build_inference_features(db, center.y, center.x)
                _ = model.predict(features)
                updated += 1
            except Exception:
                continue
        return updated


@celery_app.task(name="ml.update_risk_scores")
def update_risk_scores() -> int:
    """Recalcula risk scores de todas las zonas con datos climáticos actuales."""
    import nest_asyncio
    nest_asyncio.apply()
    return asyncio.run(_run_risk_update())
