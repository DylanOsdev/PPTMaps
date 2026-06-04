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


async def detect_overspeed(db: AsyncSession) -> list[dict]:
    """Detecta vehículos por encima del umbral en la ventana reciente y crea una
    alerta OVERSPEED por vehículo si no hay ya una activa.

    Devuelve una lista con los datos de las alertas creadas (ya serializadas)
    para que el caller pueda retransmitirlas vía Redis pub/sub.
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

    created_alerts: list[dict] = []
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
        alert = Alert(
            vehicle_id=row.vehicle_id,
            type="OVERSPEED",
            severity=AlertSeverity.WARNING,
            message=f"Exceso de velocidad: {round(row.max_speed, 1)} km/h (límite {OVERSPEED_THRESHOLD_KMH})",
        )
        db.add(alert)
        created_alerts.append(
            {
                "id": str(alert.id),
                "type": "overspeed",
                "severity": "WARNING",
                "message": alert.message,
                "vehicle_id": str(row.vehicle_id) if row.vehicle_id else None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    await db.commit()

    if created_alerts:
        logger.info("Alertas OVERSPEED creadas: %d", len(created_alerts))
        # Publica las alertas en Redis para que el servidor las reenvíe vía WS
        try:
            from app.db.redis import get_redis
            from app.services.alert_broadcaster import publish_alert

            redis = get_redis()
            for alert_data in created_alerts:
                await publish_alert(redis, alert_data)
        except Exception as e:
            logger.warning("No se pudieron publicar alertas en Redis: %s", e)

    return created_alerts


@celery_app.task(name="overspeed.check")
def check_overspeed_alerts() -> int:
    """Task periódica: corre detect_overspeed sobre una sesión nueva.

    Nota: Usamos un patrón seguro para evitar conflictos de event loops
    entre Celery y asyncpg/SQLAlchemy.
    """
    import nest_asyncio

    # Permite anidamiento de event loops (necesario para Celery + async)
    nest_asyncio.apply()

    async def _run():
        # Usamos el sessionmaker directamente, no el generador get_db()
        # que está pensado para FastAPI
        async with async_session_maker() as db:
            alerts = await detect_overspeed(db)
            return len(alerts)

    # Ejecutar de forma segura: si ya existe un loop, reusarlo
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(_run())
