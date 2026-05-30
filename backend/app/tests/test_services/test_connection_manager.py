import pytest

from app.websocket.connection_manager import ConnectionManager

pytestmark = pytest.mark.asyncio


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.sent = []

    async def accept(self):
        self.accepted = True

    async def send_json(self, data):
        self.sent.append(data)


async def test_connect_accepts_and_registers():
    mgr = ConnectionManager()
    ws = FakeWebSocket()
    await mgr.connect(ws, channel="global")
    assert ws.accepted is True
    assert ws in mgr.active_connections["global"]


async def test_broadcast_sends_to_channel_only():
    mgr = ConnectionManager()
    ws_global = FakeWebSocket()
    ws_other = FakeWebSocket()
    await mgr.connect(ws_global, channel="global")
    await mgr.connect(ws_other, channel="other")

    await mgr.broadcast({"type": "telemetry", "data": []}, channel="global")
    assert ws_global.sent == [{"type": "telemetry", "data": []}]
    assert ws_other.sent == []


async def test_disconnect_removes_connection():
    mgr = ConnectionManager()
    ws = FakeWebSocket()
    await mgr.connect(ws, channel="global")
    mgr.disconnect(ws, channel="global")
    assert ws not in mgr.active_connections.get("global", [])
