import json
import logging
import asyncio
import random
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, func, desc

from app.websocket.connection_manager import manager
from app.db.database import async_session_maker
from app.models.telemetry import Telemetry
from app.models.alert import Alert

router = APIRouter()
logger = logging.getLogger(__name__)

FALLBACK_TELEMETRY = [
    {"id": "v1", "vehicle_id": "v1", "lat": 6.2515, "lng": -75.5635, "speed": 42.5, "heading": 180},
    {"id": "v2", "vehicle_id": "v2", "lat": 6.2398, "lng": -75.5902, "speed": 35.0, "heading": 270},
    {"id": "v3", "vehicle_id": "v3", "lat": 6.2178, "lng": -75.5705, "speed": 0.0, "heading": 0},
    {"id": "v4", "vehicle_id": "v4", "lat": 6.2023, "lng": -75.5623, "speed": 55.0, "heading": 90},
    {"id": "v5", "vehicle_id": "v5", "lat": 6.2756, "lng": -75.5387, "speed": 28.0, "heading": 45},
    {"id": "v6", "vehicle_id": "v6", "lat": 6.1978, "lng": -75.5762, "speed": 65.0, "heading": 135},
    {"id": "v7", "vehicle_id": "v7", "lat": 6.2675, "lng": -75.5648, "speed": 15.0, "heading": 315},
    {"id": "v8", "vehicle_id": "v8", "lat": 6.2265, "lng": -75.5552, "speed": 48.0, "heading": 225},
    {"id": "v9", "vehicle_id": "v9", "lat": 6.2489, "lng": -75.5725, "speed": 0.0, "heading": 0},
    {"id": "v10", "vehicle_id": "v10", "lat": 6.2356, "lng": -75.5489, "speed": 72.0, "heading": 180},
]

_FALLBACK_ALERTS_DATA = [
    {"id": "a1", "type": "traffic", "severity": "WARNING", "message": "Congestión severa en Av. Oriental", "created_at": None, "is_resolved": False},
    {"id": "a2", "type": "siata", "severity": "WARNING", "message": "Nivel del río Medellín en aumento", "created_at": None, "is_resolved": False},
    {"id": "a3", "type": "traffic", "severity": "CRITICAL", "message": "Accidente múltiple en Autopista Sur", "created_at": None, "is_resolved": False},
    {"id": "a4", "type": "citizen", "severity": "INFO", "message": "Reporte: hueco profundo en Cra 48 con 33", "created_at": None, "is_resolved": False},
    {"id": "a5", "type": "siata", "severity": "CRITICAL", "message": "Quebrada La Hueso en nivel crítico", "created_at": None, "is_resolved": False},
    {"id": "a6", "type": "traffic", "severity": "WARNING", "message": "Semáforo averiado Av. 33 con Cra 70", "created_at": None, "is_resolved": False},
    {"id": "a7", "type": "citizen", "severity": "INFO", "message": "Árbol caído en Av. El Poblado", "created_at": None, "is_resolved": False},
]

@router.websocket("/telemetry")
async def websocket_telemetry(websocket: WebSocket, channel: str = Query(default="global")):
    await manager.connect(websocket, channel=channel)

    async def send_initial_state():
        try:
            async with async_session_maker() as db:
                subq = (
                    select(Telemetry.vehicle_id, func.max(Telemetry.timestamp).label("max_ts"))
                    .group_by(Telemetry.vehicle_id)
                    .subquery()
                )
                positions = await db.execute(
                    select(Telemetry).join(
                        subq,
                        (Telemetry.vehicle_id == subq.c.vehicle_id) &
                        (Telemetry.timestamp == subq.c.max_ts)
                    )
                )
                latest = positions.scalars().all()
                if latest:
                    telemetry_data = [
                        {
                            "id": str(t.id),
                            "vehicle_id": str(t.vehicle_id),
                            "lat": t.latitude,
                            "lng": t.longitude,
                            "speed": t.speed,
                            "heading": t.heading,
                            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                        }
                        for t in latest
                    ]
                    await manager.broadcast({"type": "telemetry", "data": telemetry_data}, channel=channel)
                else:
                    await manager.broadcast({"type": "telemetry", "data": FALLBACK_TELEMETRY}, channel=channel)

                alerts_result = await db.execute(
                    select(Alert).where(Alert.is_resolved == False)
                    .order_by(desc(Alert.created_at)).limit(20)
                )
                alerts_list = alerts_result.scalars().all()
                if alerts_list:
                    alerts_data = [
                        {
                            "id": str(a.id),
                            "type": a.type.lower(),
                            "severity": a.severity.value if hasattr(a.severity, 'value') else str(a.severity),
                            "message": a.message,
                            "created_at": a.created_at.isoformat() if a.created_at else None,
                            "is_resolved": a.is_resolved,
                        }
                        for a in alerts_list
                    ]
                    await manager.broadcast({"type": "alerts", "data": alerts_data}, channel=channel)
                else:
                    await manager.broadcast({"type": "alerts", "data": _FALLBACK_ALERTS_DATA}, channel=channel)
        except Exception as e:
            logger.warning(f"WS initial state fallback: {e}")
            await manager.broadcast({"type": "telemetry", "data": FALLBACK_TELEMETRY}, channel=channel)
            await manager.broadcast({"type": "alerts", "data": _FALLBACK_ALERTS_DATA}, channel=channel)

    await send_initial_state()

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                await websocket.send_json({"status": "ack", "data": msg})
            except json.JSONDecodeError:
                await websocket.send_json({"status": "error", "detail": "Mensaje JSON inválido"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel=channel)
        logger.info(f"WebSocket desconectado del canal '{channel}'")
