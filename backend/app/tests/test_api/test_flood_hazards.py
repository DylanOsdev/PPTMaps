import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MED_LNG, MED_LAT = -75.56, 6.25


def _square(lng: float, lat: float, d: float = 0.001):
    return [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
    ]


def _polygon(lng: float, lat: float):
    return [_square(lng, lat)]


async def test_create_flood_hazard(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/flood-hazards/",
        headers=auth_headers,
        json={
            "name": "Deprimido San Juan",
            "siata_station_id": "SIATA-101",
            "status": "watch",
            "water_level_m": 1.5,
            "coordinates": _polygon(MED_LNG, MED_LAT),
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] > 0
    assert data["status"] == "watch"
    assert data["geometry"]["type"] == "Polygon"


async def test_create_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/v1/flood-hazards/",
        json={"name": "x", "coordinates": _polygon(MED_LNG, MED_LAT)},
    )
    assert resp.status_code == 401


async def test_update_flood_status(client: AsyncClient, auth_headers: dict):
    created = await client.post(
        "/api/v1/flood-hazards/",
        headers=auth_headers,
        json={"name": "Quebrada La Iguaná", "coordinates": _polygon(MED_LNG, MED_LAT)},
    )
    hazard_id = created.json()["id"]
    resp = await client.put(
        f"/api/v1/flood-hazards/{hazard_id}",
        headers=auth_headers,
        json={"status": "flooded", "water_level_m": 3.2},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "flooded"


async def test_nearby_filters_by_distance(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/flood-hazards/",
        headers=auth_headers,
        json={"name": "cerca", "coordinates": _polygon(MED_LNG, MED_LAT)},
    )
    await client.post(
        "/api/v1/flood-hazards/",
        headers=auth_headers,
        json={"name": "lejos", "coordinates": _polygon(-74.07, 4.71)},
    )
    resp = await client.get(
        f"/api/v1/flood-hazards/nearby?lat={MED_LAT}&lng={MED_LNG}&radius_m=5000"
    )
    assert resp.status_code == 200
    names = [h["name"] for h in resp.json()]
    assert names == ["cerca"]
