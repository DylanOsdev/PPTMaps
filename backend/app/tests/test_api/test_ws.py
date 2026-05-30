"""Test de integración del WebSocket /ws/telemetry.

Usa el TestClient síncrono de Starlette (websocket_connect). El ws_router lee de las
tablas reales vía async_session_maker, que en el harness de test apunta a la misma
BD PostGIS (TEST_DATABASE_URL). Sembramos datos con el cliente HTTP async y luego
abrimos el socket.
"""
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.crud import create_vehicle, crud_alert
from app.schemas.vehicle import VehicleCreate
from app.schemas.alert import AlertCreate

pytestmark = pytest.mark.asyncio


async def test_ws_pushes_telemetry_and_alerts(db_session):
    # Seed: un vehículo + una alerta sin resolver en la BD de test.
    await create_vehicle(db_session, VehicleCreate(plate="WS001", type="ambulance"))
    await crud_alert.create_alert(db_session, AlertCreate(type="traffic", message="Congestión"))

    received = {}
    with TestClient(app).websocket_connect("/ws/telemetry?channel=global") as ws:
        for _ in range(2):
            msg = ws.receive_json()
            received[msg["type"]] = msg["data"]

    assert "telemetry" in received
    assert "alerts" in received
    assert isinstance(received["telemetry"], list)
    assert any(a["message"] == "Congestión" for a in received["alerts"])
