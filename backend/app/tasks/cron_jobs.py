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


@celery_app.task(name="ml.cache_predictions", bind=True)
def cache_traffic_predictions_task(self) -> int:
    """Cachea predicciones ML de congestión en Redis cada 15 minutos."""
    import json
    from pathlib import Path
    from redis import Redis
    from app.core.config import settings
    
    # Verificar que el modelo ML exista
    model_path = Path(__file__).parent.parent / "ml" / "models" / "traffic_model.joblib"
    if not model_path.exists():
        print(f"⚠️  Modelo ML no encontrado en {model_path} — saltando caché de predicciones")
        return 0
    
    # Usar Redis síncrono para evitar conflictos con asyncio
    redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    
    try:
        from app.services.traffic_prediction import get_prediction_service
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from app.core.config import settings
        
        # Crear conexión síncrona para Celery
        sync_db_url = settings.SQLALCHEMY_DATABASE_URI.replace("+asyncpg", "")
        engine = create_engine(sync_db_url)
        SessionLocal = sessionmaker(bind=engine)
        
        with SessionLocal() as db:
            service = get_prediction_service()
            # Usar el método síncrono del servicio
            from datetime import datetime
            predictions = service.predict_sync(db)
            
            if not predictions:
                print("⚠️  No se generaron predicciones ML")
                return 0
            
            # Guardar en Redis con TTL 15 min
            cache_data = {
                "predictions": predictions,
                "model": "XGBoost",
                "cached_at": datetime.utcnow().isoformat()
            }
            
            redis.setex(
                "ml:traffic_predictions",
                900,  # 15 minutos
                json.dumps(cache_data, default=str)
            )
            
            print(f"✅ {len(predictions)} predicciones ML cacheadas en Redis")
            return len(predictions)
            
    except Exception as e:
        print(f"❌ Error cacheando predicciones ML: {e}")
        self.retry(countdown=60, max_retries=3)
        return 0
    finally:
        redis.close()
