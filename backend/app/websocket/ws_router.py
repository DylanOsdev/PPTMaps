"""WebSocket de telemetría en tiempo real para el mapa del frontend.

Contrato (frontend api.js): /ws/telemetry?channel=global
- Mensaje {"type": "telemetry", "data": [{id, vehicle_id, lat, lng, speed, heading, timestamp}]}
- Mensaje {"type": "alerts", "data": [{id, type, severity, message, created_at, is_resolved}]}

Lee de las tablas reales (telemetry: última posición por vehículo; alerts: no resueltas).
"""
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, func, select

from app.db import database
from app.models.alert import Alert
from app.models.telemetry import Telemetry
from app.websocket.connection_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


async def _latest_telemetry(db) -> list[dict]:
    # Subconsulta: timestamp máximo por vehículo → última posición conocida.
    subq = (
        select(Telemetry.vehicle_id, func.max(Telemetry.timestamp).label("max_ts"))
        .group_by(Telemetry.vehicle_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Telemetry).join(
                subq,
                (Telemetry.vehicle_id == subq.c.vehicle_id)
                & (Telemetry.timestamp == subq.c.max_ts),
            )
        )
    ).scalars().all()
    return [
        {
            "id": str(t.id),
            "vehicle_id": str(t.vehicle_id),
            "lat": t.latitude,
            "lng": t.longitude,
            "speed": t.speed,
            "heading": t.heading,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
        }
        for t in rows
    ]


async def _unresolved_alerts(db) -> list[dict]:
    rows = (
        await db.execute(
            select(Alert).where(Alert.is_resolved == False).order_by(desc(Alert.created_at)).limit(20)
        )
    ).scalars().all()
    return [
        {
            "id": str(a.id),
            "type": a.type.lower(),
            "severity": a.severity.value if hasattr(a.severity, "value") else str(a.severity),
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "is_resolved": a.is_resolved,
        }
        for a in rows
    ]


@router.websocket("/telemetry")
async def websocket_telemetry(websocket: WebSocket, channel: str = Query(default="global")):
    await manager.connect(websocket, channel=channel)
    try:
        async with database.async_session_maker() as db:
            await websocket.send_json({"type": "telemetry", "data": await _latest_telemetry(db)})
            await websocket.send_json({"type": "alerts", "data": await _unresolved_alerts(db)})

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel=channel)
