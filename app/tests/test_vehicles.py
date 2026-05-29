import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

VEHICLE_PAYLOAD = {
    "plate": "ABC123",
    "model": "Hyundai Ioniq 5",
    "type": "Ambulance",
    "status": "ACTIVE",
}

async def test_create_vehicle(client: AsyncClient, auth_headers: dict):
    """Crear un vehículo con datos válidos debe retornar 201."""
    response = await client.post("/api/v1/vehicles/", json=VEHICLE_PAYLOAD, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["plate"] == "ABC123"
    assert "id" in data

async def test_create_duplicate_vehicle(client: AsyncClient, auth_headers: dict):
    """Crear un vehículo con placa duplicada debe retornar 400."""
    await client.post("/api/v1/vehicles/", json=VEHICLE_PAYLOAD, headers=auth_headers)
    response = await client.post("/api/v1/vehicles/", json=VEHICLE_PAYLOAD, headers=auth_headers)
    assert response.status_code == 400

async def test_list_vehicles(client: AsyncClient, auth_headers: dict):
    """GET /vehicles/ debe retornar una lista."""
    response = await client.get("/api/v1/vehicles/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

async def test_get_vehicle_by_id(client: AsyncClient, auth_headers: dict):
    """GET /vehicles/{id} debe retornar el vehículo correcto."""
    create_resp = await client.post(
        "/api/v1/vehicles/",
        json={"plate": "XYZ999", "type": "Bus", "status": "ACTIVE"},
        headers=auth_headers,
    )
    vehicle_id = create_resp.json()["id"]
    response = await client.get(f"/api/v1/vehicles/{vehicle_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == vehicle_id

async def test_get_nonexistent_vehicle(client: AsyncClient, auth_headers: dict):
    """GET /vehicles/{id} con UUID inexistente debe retornar 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/v1/vehicles/{fake_id}", headers=auth_headers)
    assert response.status_code == 404

async def test_vehicles_require_auth(client: AsyncClient):
    """Acceder a /vehicles/ sin token debe retornar 401."""
    response = await client.get("/api/v1/vehicles/")
    assert response.status_code == 401
