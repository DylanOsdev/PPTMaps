import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket.connection_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/telemetry")
async def websocket_telemetry(websocket: WebSocket, channel: str = Query(default="global")):
    """
    Endpoint WebSocket para recibir telemetría en tiempo real.

    Parámetro de query opcional `channel`:
    - "global" (default): recibe todas las actualizaciones.
    - "{vehicle_id}": recibe solo actualizaciones de un vehículo específico.

    Ejemplo de conexión:
      ws://localhost:8000/ws/telemetry?channel=global
      ws://localhost:8000/ws/telemetry?channel=uuid-del-vehiculo
    """
    await manager.connect(websocket, channel=channel)
    try:
        while True:
            # Esperar mensajes del cliente (ping/pong o comandos)
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Eco de vuelta: confirma recepción (útil para debugging)
                await websocket.send_json({"status": "received", "data": msg})
            except json.JSONDecodeError:
                await websocket.send_json({"status": "error", "detail": "Mensaje JSON inválido"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel=channel)
        logger.info(f"WebSocket desconectado del canal '{channel}'")
