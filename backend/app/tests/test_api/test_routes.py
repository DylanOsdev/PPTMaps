import pytest

pytestmark = pytest.mark.asyncio


async def test_routes_returns_coordinates(client):
    resp = await client.get("/api/v1/routes", params={"destination": "6.28,-75.56"})
    assert resp.status_code == 200
    data = resp.json()
    # Contrato frontend (search.js): data.coordinates = [[lat,lng], ...]
    assert "coordinates" in data and len(data["coordinates"]) >= 2
    # OSRM real devuelve coordenadas con mayor precisión, verificamos aproximación
    dest = data["coordinates"][-1]
    assert abs(dest[0] - 6.28) < 0.01 and abs(dest[1] - (-75.56)) < 0.01
    assert "distance_km" in data and "avoided_zones" in data


async def test_routes_accepts_explicit_origin(client):
    resp = await client.get(
        "/api/v1/routes", params={"origin": "6.20,-75.58", "destination": "6.28,-75.56"}
    )
    assert resp.status_code == 200
    # OSRM real devuelve coordenadas con mayor precisión
    origin = resp.json()["coordinates"][0]
    assert abs(origin[0] - 6.20) < 0.01 and abs(origin[1] - (-75.58)) < 0.01


async def test_routes_invalid_destination_returns_422(client):
    resp = await client.get("/api/v1/routes", params={"destination": "no-es-coordenada"})
    assert resp.status_code == 422
