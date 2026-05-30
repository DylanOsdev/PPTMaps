import pytest
from shapely.geometry import LineString, Polygon
from sqlalchemy import text

from app.services.routing import compute_route

pytestmark = pytest.mark.asyncio

# Origen y destino que definen una recta que pasa por ~ (6.24, -75.57).
ORIGIN = (6.20, -75.58)
DEST = (6.28, -75.56)


async def _seed_flood(db, status, lng_lat_polygon):
    coords = ",".join(f"{lng} {lat}" for lng, lat in lng_lat_polygon)
    await db.execute(
        text(
            "INSERT INTO flood_hazards (name, status, geom) VALUES "
            f"('Z', '{status}', ST_SetSRID(ST_GeomFromText('POLYGON(({coords}))'),4326))"
        )
    )
    await db.commit()


def _path_as_lnglat(coordinates):
    # coordinates vienen como [lat, lng]; shapely usa (lng, lat).
    return LineString([(lng, lat) for lat, lng in coordinates])


async def test_direct_route_when_no_risk(db_session):
    route = await compute_route(db_session, ORIGIN, DEST)
    assert route["coordinates"][0] == [ORIGIN[0], ORIGIN[1]]
    assert route["coordinates"][-1] == [DEST[0], DEST[1]]
    assert route["avoided_zones"] == 0
    assert route["distance_km"] > 0


async def test_route_avoids_active_flood_zone(db_session):
    # Polígono inundado sobre la recta directa (alrededor del punto medio).
    poly = [(-75.575, 6.235), (-75.565, 6.235), (-75.565, 6.245), (-75.575, 6.245), (-75.575, 6.235)]
    await _seed_flood(db_session, "flooded", poly)

    route = await compute_route(db_session, ORIGIN, DEST)

    assert route["avoided_zones"] >= 1
    assert len(route["coordinates"]) >= 3  # insertó al menos un waypoint
    # El camino resultante NO cruza la zona de riesgo.
    assert not _path_as_lnglat(route["coordinates"]).intersects(Polygon(poly))


async def test_dry_zone_is_ignored(db_session):
    poly = [(-75.575, 6.235), (-75.565, 6.235), (-75.565, 6.245), (-75.575, 6.245), (-75.575, 6.235)]
    await _seed_flood(db_session, "dry", poly)

    route = await compute_route(db_session, ORIGIN, DEST)
    assert route["avoided_zones"] == 0
    assert len(route["coordinates"]) == 2  # ruta directa, sin desvío
