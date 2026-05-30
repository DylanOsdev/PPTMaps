import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_vehicle_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/vehicles/", json={"plate": "NOAUTH", "type": "ambulance"})
    assert resp.status_code in (401, 403)


async def test_create_and_get_vehicle(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/vehicles/",
        json={"plate": "API001", "model": "Ambulancia", "type": "ambulance"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["plate"] == "API001"
    vehicle_id = body["id"]

    got = await client.get(f"/api/v1/vehicles/{vehicle_id}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["plate"] == "API001"


async def test_create_duplicate_plate(client: AsyncClient, auth_headers: dict):
    payload = {"plate": "DUP001", "type": "patrol"}
    await client.post("/api/v1/vehicles/", json=payload, headers=auth_headers)
    resp = await client.post("/api/v1/vehicles/", json=payload, headers=auth_headers)
    assert resp.status_code == 400


async def test_list_vehicles(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/vehicles/", json={"plate": "LST1", "type": "ambulance"}, headers=auth_headers)
    resp = await client.get("/api/v1/vehicles/", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
