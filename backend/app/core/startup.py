"""Startup tasks — lógica de inicialización extraída del lifespan de main.py."""

import asyncio
import logging
from datetime import datetime, timezone

from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy import select, text

from app.core.config import settings
from app.db.database import engine, async_session_maker
from app.services.zones_seed import seed_zones_on_startup

logger = logging.getLogger(__name__)


async def verify_db_connection() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Conexión a PostgreSQL/PostGIS establecida correctamente.")


async def seed_zones_if_empty() -> int:
    async with async_session_maker() as db:
        seeded = await seed_zones_on_startup(db, settings.ZONES_JSON_PATH)
    if seeded:
        logger.info("Zonas sembradas en PostGIS: %d", seeded)
    return seeded


async def seed_initial_data() -> None:
    async with async_session_maker() as db:
        from app.services.ingestion import sync_soda_incidents
        await sync_soda_incidents(db)

        from app.services.siata_sync import SiataSyncService, _create_siata_client
        client = await _create_siata_client()
        await SiataSyncService(client).sync(db)

        await _seed_alerts(db)
        await _seed_demo_vehicles(db)

    _enqueue_startup_syncs()


async def _seed_alerts(db) -> None:
    from app.crud.crud_alert import get_alerts, create_alert
    from app.schemas.alert import AlertCreate
    from app.models.alert import AlertSeverity

    existing = await get_alerts(db, is_resolved=False, limit=1)
    if not existing:
        seed_alerts = [
            AlertCreate(type="traffic", severity=AlertSeverity.WARNING, message="Congestión vehicular en Av. Oriental - sector Centro"),
            AlertCreate(type="traffic", severity=AlertSeverity.INFO, message="Flujo lento en Autopista Sur sentido Norte-Sur"),
            AlertCreate(type="siata", severity=AlertSeverity.INFO, message="Nivel normal en estaciones SIATA - Valle de Aburrá"),
            AlertCreate(type="siata", severity=AlertSeverity.WARNING, message="Monitoreo activo en quebrada La Iguana"),
        ]
        for alert_in in seed_alerts:
            await create_alert(db, alert_in)
        logger.info("Alertas iniciales sembradas: %d", len(seed_alerts))


async def _seed_demo_vehicles(db) -> None:
    from app.models.vehicle import Vehicle
    from app.models.telemetry import Telemetry

    existing_vehicles = (await db.execute(select(Vehicle).limit(1))).scalar_one_or_none()
    if existing_vehicles:
        return

    DEMO_VEHICLES = [
        {"plate": "AMB-001", "type": "ambulance", "lat": 6.2515, "lng": -75.5635, "speed": 42.0, "heading": 180},
        {"plate": "AMB-002", "type": "ambulance", "lat": 6.2398, "lng": -75.5902, "speed": 35.0, "heading": 270},
        {"plate": "PAT-010", "type": "patrol", "lat": 6.2178, "lng": -75.5705, "speed": 0.0, "heading": 0},
        {"plate": "PAT-011", "type": "patrol", "lat": 6.2756, "lng": -75.5387, "speed": 95.0, "heading": 45},
        {"plate": "BMB-020", "type": "fire", "lat": 6.1978, "lng": -75.5762, "speed": 65.0, "heading": 135},
        {"plate": "BMB-021", "type": "fire", "lat": 6.2489, "lng": -75.5725, "speed": 28.0, "heading": 90},
        {"plate": "PAT-012", "type": "patrol", "lat": 6.2356, "lng": -75.5489, "speed": 55.0, "heading": 315},
        {"plate": "AMB-003", "type": "ambulance", "lat": 6.2265, "lng": -75.5552, "speed": 72.0, "heading": 0},
    ]
    for v in DEMO_VEHICLES:
        vehicle = Vehicle(plate=v["plate"], type=v["type"])
        db.add(vehicle)
        await db.flush()
        telemetry = Telemetry(
            vehicle_id=vehicle.id,
            latitude=v["lat"],
            longitude=v["lng"],
            speed=v["speed"],
            heading=v["heading"],
            location=ST_SetSRID(ST_MakePoint(v["lng"], v["lat"]), 4326),
            timestamp=datetime.now(timezone.utc),
        )
        db.add(telemetry)
    await db.commit()
    logger.info("Telemetría demo sembrada: %d vehículos", len(DEMO_VEHICLES))


def _enqueue_startup_syncs() -> None:
    from app.tasks.cron_jobs import sync_weather
    try:
        sync_weather.delay()
    except Exception as e:
        logger.warning("No se pudo encolar weather.sync al arrancar: %s", e)


async def start_background_tasks(app_state: dict) -> None:
    from app.services.demo_simulator import run_demo_simulator
    _sim_stop = asyncio.Event()
    _sim_task = asyncio.create_task(run_demo_simulator(_sim_stop))
    app_state["sim_stop"] = _sim_stop
    app_state["sim_task"] = _sim_task

    from app.db.redis import check_redis_ready, get_redis
    from app.services.alert_broadcaster import listen_and_broadcast_alerts

    async def _start_alert_listener():
        ready = await check_redis_ready()
        if not ready:
            logger.info("Redis no disponible — listener de alertas desactivado.")
            return
        try:
            redis = get_redis()
            await listen_and_broadcast_alerts(redis)
        except asyncio.CancelledError:
            logger.info("Listener de alertas detenido.")
        except Exception as e:
            logger.warning("No se pudo iniciar listener de alertas: %s", e)

    app_state["alert_listener_task"] = asyncio.create_task(_start_alert_listener())


async def stop_background_tasks(app_state: dict) -> None:
    if alert_task := app_state.get("alert_listener_task"):
        alert_task.cancel()
        try:
            await alert_task
        except asyncio.CancelledError:
            pass

    if sim_stop := app_state.get("sim_stop"):
        sim_stop.set()
    if sim_task := app_state.get("sim_task"):
        sim_task.cancel()
        try:
            await sim_task
        except asyncio.CancelledError:
            pass
