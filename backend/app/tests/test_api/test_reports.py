import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MED_LNG, MED_LAT = -75.56, 6.25


async def test_create_report(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/reports/",
        headers=auth_headers,
        json={
            "report_type": "accident",
            "description": "Choque en la 80",
            "latitude": MED_LAT,
            "longitude": MED_LNG,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] > 0
    # El geom POINT debe re-derivarse a lat/lon en la salida.
    assert data["latitude"] == pytest.approx(MED_LAT)
    assert data["longitude"] == pytest.approx(MED_LNG)


async def test_create_report_public(client: AsyncClient):
    resp = await client.post(
        "/api/v1/reports/",
        json={"report_type": "flood", "latitude": MED_LAT, "longitude": MED_LNG},
    )
    assert resp.status_code == 201  # Endpoint público, no requiere auth


async def test_list_and_get_report(client: AsyncClient, auth_headers: dict):
    created = await client.post(
        "/api/v1/reports/",
        headers=auth_headers,
        json={"report_type": "obstruction", "latitude": MED_LAT, "longitude": MED_LNG},
    )
    report_id = created.json()["id"]

    listed = await client.get("/api/v1/reports/", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    fetched = await client.get(f"/api/v1/reports/{report_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == report_id


async def test_get_report_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/reports/9999", headers=auth_headers)
    assert resp.status_code == 404
