"""Ruteo resiliente (opción B): traza una ruta origen→destino y, si cruza una zona
de riesgo activa (inundación watch/flooded o zona de accidentalidad severa), inserta
un waypoint que la rodea. Usa las geometrías reales almacenadas en PostGIS.
"""
import json
import math
from typing import List, Tuple

from shapely.geometry import LineString, shape
from shapely.ops import unary_union
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Umbral de severidad para considerar una zona de accidentalidad como riesgo a evitar.
ACCIDENT_SEVERITY_THRESHOLD = 3
# Margen extra (grados, ~0.005 ≈ 550 m) que se suma al desvío para librar la zona.
DETOUR_MARGIN_DEG = 0.005

Coord = Tuple[float, float]  # (lat, lng)


def _haversine_km(a: Coord, b: Coord) -> float:
    r = 6371.0
    lat1, lng1, lat2, lng2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


async def _active_risk_geoms(db: AsyncSession):
    rows = (
        await db.execute(
            text(
                "SELECT ST_AsGeoJSON(geom) AS g FROM flood_hazards "
                "WHERE status IN ('watch','flooded') "
                "UNION ALL "
                "SELECT ST_AsGeoJSON(geom) AS g FROM accident_zones WHERE severity >= :sev"
            ),
            {"sev": ACCIDENT_SEVERITY_THRESHOLD},
        )
    ).all()
    return [shape(json.loads(r.g)) for r in rows if r.g]


def _detour_waypoint(line: LineString, blob) -> Tuple[float, float]:
    """Devuelve un waypoint (lng, lat) perpendicular a la ruta que esquiva el obstáculo."""
    (x0, y0), (x1, y1) = line.coords[0], line.coords[-1]
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy) or 1e-9
    px, py = -dy / length, dx / length  # perpendicular unitario
    c = blob.centroid
    minx, miny, maxx, maxy = blob.bounds
    radius = math.hypot(maxx - minx, maxy - miny) / 2

    # Aumenta el desvío hasta que ambos tramos libren el obstáculo.
    offset = radius + DETOUR_MARGIN_DEG
    for _ in range(6):
        for sign in (1, -1):
            wp = (c.x + sign * px * offset, c.y + sign * py * offset)
            detour = LineString([(x0, y0), wp, (x1, y1)])
            if not detour.intersects(blob):
                return wp
        offset += radius + DETOUR_MARGIN_DEG
    # Fallback: desvío amplio hacia un lado.
    return (c.x + px * offset, c.y + py * offset)


async def compute_route(db: AsyncSession, origin: Coord, dest: Coord) -> dict:
    """origin/dest como (lat, lng). Devuelve {coordinates:[[lat,lng]...], distance_km, avoided_zones}."""
    o_ll, d_ll = (origin[1], origin[0]), (dest[1], dest[0])  # shapely usa (lng, lat)
    line = LineString([o_ll, d_ll])

    obstacles = [z for z in await _active_risk_geoms(db) if line.intersects(z)]

    if not obstacles:
        coords = [[origin[0], origin[1]], [dest[0], dest[1]]]
        return {"coordinates": coords, "distance_km": round(_haversine_km(origin, dest), 3), "avoided_zones": 0}

    waypoint = _detour_waypoint(line, unary_union(obstacles))
    path_ll = [o_ll, waypoint, d_ll]
    coords = [[lng_lat[1], lng_lat[0]] for lng_lat in path_ll]  # (lng,lat) → [lat,lng]
    distance = sum(_haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
    return {"coordinates": coords, "distance_km": round(distance, 3), "avoided_zones": len(obstacles)}
