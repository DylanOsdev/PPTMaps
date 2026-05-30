import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.tasks.celery_app import celery_app
from app.db.database import async_session_maker as AsyncSessionLocal
from app.models.telemetry import Telemetry
from app.models.alert import Alert, AlertSeverity

logger = logging.getLogger(__name__)

OVERSPEED_THRESHOLD_KMH = 80.0  # Límite de velocidad configurado

@celery_app.task(name="app.tasks.worker.check_overspeed_alerts")
def check_overspeed_alerts():
    """
    Tarea periódica: detecta vehículos con exceso de velocidad en el último minuto.
    Crea alertas de tipo OVERSPEED si no existe una activa para el mismo vehículo.
    """
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            since = datetime.utcnow() - timedelta(minutes=2)
            result = await db.execute(
                select(Telemetry.vehicle_id, func.max(Telemetry.speed).label("max_speed"))
                .where(Telemetry.timestamp >= since)
                .where(Telemetry.speed > OVERSPEED_THRESHOLD_KMH)
                .group_by(Telemetry.vehicle_id)
            )
            rows = result.fetchall()

            for row in rows:
                # Verificar si ya hay una alerta activa del mismo tipo
                existing = await db.execute(
                    select(Alert).where(
                        Alert.vehicle_id == row.vehicle_id,
                        Alert.type == "OVERSPEED",
                        Alert.is_resolved == False,
                    )
                )
                if not existing.scalar_one_or_none():
                    alert = Alert(
                        vehicle_id=row.vehicle_id,
                        type="OVERSPEED",
                        severity=AlertSeverity.WARNING,
                        message=f"Exceso de velocidad detectado: {round(row.max_speed, 1)} km/h (límite {OVERSPEED_THRESHOLD_KMH} km/h)",
                    )
                    db.add(alert)

            await db.commit()
            logger.info(f"check_overspeed_alerts: {len(rows)} vehículos con exceso de velocidad.")

    asyncio.run(_run())

@celery_app.task(name="app.tasks.worker.calculate_hourly_stats")
def calculate_hourly_stats():
    """
    Tarea periódica: calcula estadísticas horarias de velocidad por vehículo.
    Puede integrarse con un sistema de caché o tablas de resumen para dashboards.
    """
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            since = datetime.utcnow() - timedelta(hours=1)
            result = await db.execute(
                select(
                    Telemetry.vehicle_id,
                    func.count(Telemetry.id).label("records"),
                    func.avg(Telemetry.speed).label("avg_speed"),
                    func.max(Telemetry.speed).label("max_speed"),
                )
                .where(Telemetry.timestamp >= since)
                .group_by(Telemetry.vehicle_id)
            )
            rows = result.fetchall()
            for r in rows:
                logger.info(
                    f"[Hourly] Vehicle {r.vehicle_id}: "
                    f"{r.records} registros, avg={round(r.avg_speed or 0, 1)} km/h, "
                    f"max={round(r.max_speed or 0, 1)} km/h"
                )

    asyncio.run(_run())
