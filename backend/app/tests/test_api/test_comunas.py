import pytest

from app.services.zones_seed import import_zones

pytestmark = pytest.mark.asyncio

SAMPLE = {
    "comunas": [{
        "id": 1, "number": 1, "name": "Popular", "slug": "popular", "type": "comuna",
        "center": [6.29, -75.55],
        "geojson": {"type": "Feature", "properties": {"name": "Popular"},
                    "geometry": {"type": "Polygon", "coordinates": [[[-75.56, 6.29], [-75.54, 6.29], [-75.54, 6.31], [-75.56, 6.29]]]}},
    }],
    "municipios": [{
        "id": 100, "name": "Bello", "slug": "bello", "color": "#6b8cba",
        "center": [6.33, -75.56],
        "geojson": {"type": "Feature", "properties": {"name": "Bello"},
                    "geometry": {"type": "Point", "coordinates": [-75.56, 6.33]}},
    }],
}


async def test_comunas_returns_frontend_contract(client, db_session):
    await import_zones(db_session, SAMPLE)

    resp = await client.get("/api/v1/public/comunas")
    assert resp.status_code == 200
    data = resp.json()
    assert {"city", "comunas", "municipios"} <= set(data)
    assert "outline" in data["city"] and "center" in data["city"]

    c = data["comunas"][0]
    assert c["name"] == "Popular"
    assert c["number"] == 1
    assert c["slug"] == "popular"
    assert c["type"] == "comuna"
    assert c["center"] == [6.29, -75.55]
    assert c["geojson"]["type"] == "Feature"
    assert c["geojson"]["geometry"]["type"] == "Polygon"

    m = data["municipios"][0]
    assert m["name"] == "Bello"
    assert m["color"] == "#6b8cba"
    assert m["center"] == [6.33, -75.56]
    assert m["geojson"]["geometry"]["type"] == "Point"


async def test_comunas_empty_when_no_zones(client):
    resp = await client.get("/api/v1/public/comunas")
    assert resp.status_code == 200
    data = resp.json()
    assert data["comunas"] == []
    assert data["municipios"] == []
