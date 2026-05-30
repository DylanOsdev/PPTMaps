"""Gestor de conexiones WebSocket por canal.

Mantiene las conexiones activas agrupadas por canal y permite difundir mensajes
a todos los clientes de un canal (p.ej. el canal 'global' del mapa en vivo).
"""
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List] = {}

    async def connect(self, websocket, channel: str = "global"):
        await websocket.accept()
        self.active_connections.setdefault(channel, []).append(websocket)

    def disconnect(self, websocket, channel: str = "global"):
        conns = self.active_connections.get(channel)
        if conns and websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, message: dict, channel: str = "global"):
        dead = []
        for ws in list(self.active_connections.get(channel, [])):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, channel=channel)


# Instancia única compartida (importada por ws_router y notification).
manager = ConnectionManager()
