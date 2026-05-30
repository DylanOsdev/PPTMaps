import pytest

pytestmark = pytest.mark.asyncio


async def test_routes_returns_coordinates(client):
    resp = await client.get("/api/v1/routes", params={"destination": "6.28,-75.56"})
    assert resp.status_code == 200
    data = resp.json()
    # Contrato frontend (search.js): data.coordinates = [[lat,lng], ...]
    assert "coordinates" in data and len(data["coordinates"]) >= 2
    assert data["coordinates"][-1] == [6.28, -75.56]
    assert "distance_km" in data and "avoided_zones" in data


async def test_routes_accepts_explicit_origin(client):
    resp = await client.get(
        "/api/v1/routes", params={"origin": "6.20,-75.58", "destination": "6.28,-75.56"}
    )
    assert resp.status_code == 200
    assert resp.json()["coordinates"][0] == [6.20, -75.58]


async def test_routes_invalid_destination_returns_422(client):
    resp = await client.get("/api/v1/routes", params={"destination": "no-es-coordenada"})
    assert resp.status_code == 422
