"""Worker Celery: detección de exceso de velocidad sobre la telemetría reciente.

La lógica vive en detect_overspeed(db) (async, testeable). El task Celery es un
wrapper fino que abre una sesión y ejecuta el core.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session_maker
from app.models.alert import Alert, AlertSeverity
from app.models.telemetry import Telemetry
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

OVERSPEED_THRESHOLD_KMH = 80.0
WINDOW_MINUTES = 2


async def detect_overspeed(db: AsyncSession) -> int:
    """Detecta vehículos por encima del umbral en la ventana reciente y crea una
    alerta OVERSPEED por vehículo si no hay ya una activa. Devuelve cuántas creó.
    """
    since = datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)
    rows = (
        await db.execute(
            select(Telemetry.vehicle_id, func.max(Telemetry.speed).label("max_speed"))
            .where(Telemetry.timestamp >= since)
            .where(Telemetry.speed > OVERSPEED_THRESHOLD_KMH)
            .group_by(Telemetry.vehicle_id)
        )
    ).all()

    created = 0
    for row in rows:
        active = (
            await db.execute(
                select(Alert).where(
                    Alert.vehicle_id == row.vehicle_id,
                    Alert.type == "OVERSPEED",
                    Alert.is_resolved == False,
                )
            )
        ).scalar_one_or_none()
        if active:
            continue
        db.add(
            Alert(
                vehicle_id=row.vehicle_id,
                type="OVERSPEED",
                severity=AlertSeverity.WARNING,
                message=f"Exceso de velocidad: {round(row.max_speed, 1)} km/h (límite {OVERSPEED_THRESHOLD_KMH})",
            )
        )
        created += 1

    await db.commit()
    return created


@celery_app.task(name="overspeed.check")
def check_overspeed_alerts() -> int:
    """Task periódica: corre detect_overspeed sobre una sesión nueva."""

    async def _run():
        async with async_session_maker() as db:
            return await detect_overspeed(db)

    return asyncio.run(_run())
