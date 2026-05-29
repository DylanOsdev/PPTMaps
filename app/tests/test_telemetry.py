import pytest
from datetime import datetime, timezone
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def _get_vehicle_id(client: AsyncClient, headers: dict) -> str:
    """Helper: crea un vehículo y retorna su UUID."""
    resp = await client.post(
        "/api/v1/vehicles/",
        json={"plate": f"TEL{datetime.now().microsecond}", "type": "Drone", "status": "ACTIVE"},
        headers=headers,
    )
    return resp.json()["id"]

async def test_ingest_single_telemetry(client: AsyncClient, auth_headers: dict):
    """POST /telemetry/ con datos válidos debe retornar 201."""
    vehicle_id = await _get_vehicle_id(client, auth_headers)
    payload = {
        "vehicle_id": vehicle_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "latitude": 6.2518,
        "longitude": -75.5636,
        "speed": 45.5,
        "heading": 180.0,
    }
    response = await client.post("/api/v1/telemetry/", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["vehicle_id"] == vehicle_id
    assert data["latitude"] == 6.2518

async def test_bulk_ingest_telemetry(client: AsyncClient, auth_headers: dict):
    """POST /telemetry/bulk debe ingestar múltiples registros."""
    vehicle_id = await _get_vehicle_id(client, auth_headers)
    payload = {
        "data": [
            {
                "vehicle_id": vehicle_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latitude": 6.25 + i * 0.001,
                "longitude": -75.56 + i * 0.001,
                "speed": 30.0 + i,
            }
            for i in range(5)
        ]
    }
    response = await client.post("/api/v1/telemetry/bulk", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["message"] == "5 registros ingresados correctamente"

async def test_list_telemetry(client: AsyncClient, auth_headers: dict):
    """GET /telemetry/ debe retornar una lista."""
    response = await client.get("/api/v1/telemetry/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

async def test_latest_telemetry(client: AsyncClient, auth_headers: dict):
    """GET /telemetry/latest debe retornar la última posición por vehículo."""
    response = await client.get("/api/v1/telemetry/latest", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
