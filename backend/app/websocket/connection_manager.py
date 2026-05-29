import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Gestiona las conexiones WebSocket activas.
    Permite broadcast global y mensajes por canal (ej. por vehicle_id o zona).
    """

    def __init__(self):
        # Mapa de channel_id -> lista de conexiones WS activas
        self._channels: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str = "global"):
        await websocket.accept()
        if channel not in self._channels:
            self._channels[channel] = []
        self._channels[channel].append(websocket)
        logger.info(f"Cliente conectado al canal '{channel}'. Total: {len(self._channels[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str = "global"):
        if channel in self._channels:
            self._channels[channel].remove(websocket)
        logger.info(f"Cliente desconectado del canal '{channel}'.")

    async def broadcast(self, message: dict, channel: str = "global"):
        """Envía un mensaje JSON a todos los clientes suscritos a un canal."""
        if channel not in self._channels:
            return
        dead_connections = []
        for connection in self._channels[channel]:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                dead_connections.append(connection)
        # Limpiar conexiones muertas
        for dead in dead_connections:
            self._channels[channel].remove(dead)

    async def broadcast_all(self, message: dict):
        """Envía un mensaje a TODOS los canales activos."""
        for channel in list(self._channels.keys()):
            await self.broadcast(message, channel=channel)

# Singleton global del manager
manager = ConnectionManager()
