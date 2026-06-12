import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# Medellín centro como punto de referencia (lng, lat).
MED_LNG, MED_LAT = -75.56, 6.25


def _square(lng: float, lat: float, d: float = 0.001):
    """Anillo cuadrado cerrado alrededor de (lng, lat)."""
    return [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
    ]


def _multipolygon(lng: float, lat: float):
    return [[_square(lng, lat)]]


async def test_create_accident_zone(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/accident-zones/",
        headers=auth_headers,
        json={
            "name": "Glorieta peligrosa",
            "severity": 4,
            "incident_count": 12,
            "coordinates": _multipolygon(MED_LNG, MED_LAT),
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] > 0
    assert data["severity"] == 4
    assert data["geometry"]["type"] == "MultiPolygon"


async def test_create_accident_zone_public(client: AsyncClient):
    resp = await client.post(
        "/api/v1/accident-zones/",
        json={"severity": 1, "coordinates": _multipolygon(MED_LNG, MED_LAT)},
    )
    assert resp.status_code == 201  # Endpoint público


async def test_list_accident_zones(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/accident-zones/",
        headers=auth_headers,
        json={"severity": 2, "coordinates": _multipolygon(MED_LNG, MED_LAT)},
    )
    resp = await client.get("/api/v1/accident-zones/")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_get_accident_zone_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/accident-zones/9999")
    assert resp.status_code == 404


async def test_nearby_filters_by_distance(client: AsyncClient, auth_headers: dict):
    # Zona cercana: en Medellín.
    await client.post(
        "/api/v1/accident-zones/",
        headers=auth_headers,
        json={"name": "cerca", "severity": 3, "coordinates": _multipolygon(MED_LNG, MED_LAT)},
    )
    # Zona lejana: en Bogotá (~300 km).
    await client.post(
        "/api/v1/accident-zones/",
        headers=auth_headers,
        json={"name": "lejos", "severity": 3, "coordinates": _multipolygon(-74.07, 4.71)},
    )
    resp = await client.get(
        f"/api/v1/accident-zones/nearby?lat={MED_LAT}&lng={MED_LNG}&radius_m=5000"
    )
    assert resp.status_code == 200
    names = [z["name"] for z in resp.json()]
    assert names == ["cerca"]
