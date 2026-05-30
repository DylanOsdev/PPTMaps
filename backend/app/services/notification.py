import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.alert import Alert, AlertSeverity
from app.crud.crud_alert import create_alert
from app.schemas.alert import AlertCreate
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)

async def notify_alert(
    db: AsyncSession,
    alert_type: str,
    message: str,
    severity: AlertSeverity = AlertSeverity.INFO,
    vehicle_id: Optional[str] = None,
    broadcast: bool = True,
) -> Alert:
    alert_in = AlertCreate(
        type=alert_type,
        severity=severity,
        message=message,
        vehicle_id=vehicle_id,
    )
    alert = await create_alert(db, alert_in)

    if broadcast:
        await manager.broadcast({
            "type": "alerts",
            "data": [{
                "id": str(alert.id),
                "type": alert.type.lower(),
                "severity": alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity),
                "message": alert.message,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
            }],
        })

    return alert

async def notify_overspeed(db: AsyncSession, vehicle_id: str, speed: float):
    return await notify_alert(
        db,
        alert_type="OVERSPEED",
        severity=AlertSeverity.WARNING,
        message=f"Exceso de velocidad: {speed:.1f} km/h",
        vehicle_id=vehicle_id,
    )

async def notify_flood_warning(db: AsyncSession, station_name: str, level: float):
    return await notify_alert(
        db,
        alert_type="SIATA",
        severity=AlertSeverity.WARNING if level < 2.0 else AlertSeverity.CRITICAL,
        message=f"Alerta de inundación en {station_name}: nivel {level:.1f}m",
    )
