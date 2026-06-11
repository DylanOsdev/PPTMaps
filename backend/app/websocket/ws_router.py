"""WebSocket de alertas en tiempo real para el mapa del frontend.

Contrato (frontend api.js): /ws/alerts?channel=global
- Mensaje {"type": "alerts", "data": [{id, type, severity, message, created_at, is_resolved}]}

Lee alertas no resueltas de la tabla alerts.
"""
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, select

from app.db import database
from app.models.alert import Alert
from app.websocket.connection_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


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


@router.websocket("/alerts")
async def websocket_alerts(websocket: WebSocket, channel: str = Query(default="global")):
    """WebSocket que transmite alertas en tiempo real."""
    await manager.connect(websocket, channel=channel)
    try:
        async with database.async_session_maker() as db:
            await websocket.send_json({"type": "alerts", "data": await _unresolved_alerts(db)})

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel=channel)
