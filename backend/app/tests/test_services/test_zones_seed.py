from app.services.zones_seed import parse_zones

SAMPLE = {
    "city": {"name": "Medellín"},
    "comunas": [
        {
            "id": 1, "number": 1, "name": "Popular", "slug": "popular", "type": "comuna",
            "center": [6.29, -75.55],
            "geojson": {"type": "Feature", "properties": {"name": "Popular"},
                        "geometry": {"type": "Polygon", "coordinates": [[[-75.56, 6.29], [-75.54, 6.29], [-75.54, 6.31], [-75.56, 6.29]]]}},
        }
    ],
    "municipios": [
        {
            "id": 100, "name": "Bello", "slug": "bello", "color": "#6b8cba",
            "center": [6.33, -75.56],
            "geojson": {"type": "Feature", "properties": {"name": "Bello"},
                        "geometry": {"type": "Point", "coordinates": [-75.56, 6.33]}},
        }
    ],
}


def test_parse_extracts_comuna_and_municipio():
    zones = parse_zones(SAMPLE)
    assert len(zones) == 2

    comuna = next(z for z in zones if z["kind"] == "comuna")
    assert comuna["name"] == "Popular"
    assert comuna["slug"] == "popular"
    assert comuna["number"] == 1
    assert comuna["center_lat"] == 6.29
    assert comuna["center_lng"] == -75.55
    assert comuna["geometry"]["type"] == "Polygon"

    muni = next(z for z in zones if z["kind"] == "municipio")
    assert muni["name"] == "Bello"
    assert muni["color"] == "#6b8cba"
    assert muni["number"] is None
    assert muni["geometry"]["type"] == "Point"


def test_parse_empty_dict_returns_empty():
    assert parse_zones({}) == []


import pytest
from sqlalchemy import select, func
from app.services.zones_seed import import_zones
from app.models.zone import Zone


@pytest.mark.asyncio
async def test_import_zones_into_postgis(db_session):
    n = await import_zones(db_session, SAMPLE)
    assert n == 2
    count = (await db_session.execute(select(func.count()).select_from(Zone))).scalar_one()
    assert count == 2


@pytest.mark.asyncio
async def test_import_zones_is_idempotent(db_session):
    await import_zones(db_session, SAMPLE)
    await import_zones(db_session, SAMPLE)  # segunda corrida no duplica
    count = (await db_session.execute(select(func.count()).select_from(Zone))).scalar_one()
    assert count == 2
