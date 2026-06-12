"""Ruteo resiliente: traza una ruta origen→destino evitando zonas climáticas
de alto riesgo (tormentas activas, zonas de rayos, granizo) y zonas de inundación.
"""
import json
import math
import logging
from typing import List, Tuple
import httpx

from shapely.geometry import LineString, shape
from shapely.ops import unary_union
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

WEATHER_SEVERITY_THRESHOLD = 3
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
                "SELECT ST_AsGeoJSON(geom) AS g FROM weather_hazard_zones WHERE severity >= :sev"
            ),
            {"sev": WEATHER_SEVERITY_THRESHOLD},
        )
    ).all()
    return [shape(json.loads(r.g)) for r in rows if r.g]


def _detour_waypoint(line: LineString, blob) -> Tuple[float, float]:
    (x0, y0), (x1, y1) = line.coords[0], line.coords[-1]
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy) or 1e-9
    px, py = -dy / length, dx / length
    c = blob.centroid
    minx, miny, maxx, maxy = blob.bounds
    radius = math.hypot(maxx - minx, maxy - miny) / 2

    offset = radius + DETOUR_MARGIN_DEG
    for _ in range(6):
        for sign in (1, -1):
            wp = (c.x + sign * px * offset, c.y + sign * py * offset)
            detour = LineString([(x0, y0), wp, (x1, y1)])
            if not detour.intersects(blob):
                return wp
        offset += radius + DETOUR_MARGIN_DEG
    return (c.x + px * offset, c.y + py * offset)


async def _fetch_osrm_route(coords_ll: List[Coord]) -> dict:
    coords_str = ";".join([f"{lng},{lat}" for lng, lat in coords_ll])
    url = f"http://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"
    try:
        headers = {"User-Agent": "PPTMaps/1.0 (CommandCenter)"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("routes"):
                    route_coords_ll = data["routes"][0]["geometry"]["coordinates"]
                    route_coords = [[lat, lng] for lng, lat in route_coords_ll]
                    distance_km = data["routes"][0].get("distance", 0) / 1000.0
                    return {"coordinates": route_coords, "distance_km": round(distance_km, 3)}
            else:
                logging.warning(f"OSRM returned {resp.status_code}: {resp.text}")
    except Exception as e:
        logging.warning(f"OSRM routing failed: {e}")
    return None


async def compute_route(db: AsyncSession, origin: Coord, dest: Coord) -> dict:
    o_ll, d_ll = (origin[1], origin[0]), (dest[1], dest[0])
    line = LineString([o_ll, d_ll])

    obstacles = [z for z in await _active_risk_geoms(db) if line.intersects(z)]

    path_ll = [o_ll, d_ll]
    if obstacles:
        waypoint = _detour_waypoint(line, unary_union(obstacles))
        path_ll = [o_ll, waypoint, d_ll]

    route_data = await _fetch_osrm_route(path_ll)
    if not route_data:
        coords = [[lng_lat[1], lng_lat[0]] for lng_lat in path_ll]
        distance = sum(_haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
        route_data = {"coordinates": coords, "distance_km": round(distance, 3)}

    route_data["avoided_zones"] = len(obstacles)

    route_coords = route_data["coordinates"]
    route_line_wkt = f"LINESTRING({','.join(f'{c[1]} {c[0]}' for c in route_coords)})"

    comunas_rows = (await db.execute(
        text(
            "SELECT DISTINCT name FROM zones "
            "WHERE kind = 'comuna' AND ST_Intersects(geom, ST_SetSRID(ST_GeomFromText(:wkt), 4326))"
        ),
        {"wkt": route_line_wkt}
    )).all()
    comunas_nombres = [r.name for r in comunas_rows]

    dest_zone = (await db.execute(
        text(
            "SELECT name, severity, event_count FROM weather_hazard_zones "
            "ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) LIMIT 1"
        ),
        {"lng": dest[1], "lat": dest[0]}
    )).fetchone()

    intersected_zones = (await db.execute(
        text(
            "SELECT name, severity, event_count FROM weather_hazard_zones "
            "WHERE ST_DWithin(geom, ST_SetSRID(ST_GeomFromText(:wkt), 4326), 0.001)"
        ),
        {"wkt": route_line_wkt}
    )).all()

    flood_intersected = (await db.execute(
        text(
            "SELECT name, status FROM flood_hazards "
            "WHERE status IN ('watch', 'flooded') AND ST_DWithin(geom, ST_SetSRID(ST_GeomFromText(:wkt), 4326), 0.001)"
        ),
        {"wkt": route_line_wkt}
    )).all()

    dest_danger_score = 1
    dest_danger_level = "Bajo"
    dest_desc = "Zona de destino segura. Clima estable."

    if dest_zone:
        dest_danger_score = dest_zone.severity
        if dest_danger_score >= 4:
            dest_danger_level = "Alto"
            dest_desc = f"Destino con condiciones climáticas severas ({dest_zone.name}, {dest_zone.event_count} eventos)."
        elif dest_danger_score >= 3:
            dest_danger_level = "Medio"
            dest_desc = f"Destino con clima inestable ({dest_zone.name}, {dest_zone.event_count} eventos)."
        else:
            dest_danger_level = "Bajo"
            dest_desc = f"Destino con clima favorable ({dest_zone.name})."

    max_route_severity = 0
    for z in intersected_zones:
        max_route_severity = max(max_route_severity, z.severity)
    for f in flood_intersected:
        if f.status == "flooded":
            max_route_severity = max(max_route_severity, 5)
        elif f.status == "watch":
            max_route_severity = max(max_route_severity, 3)

    route_danger_score = max_route_severity
    if route_danger_score >= 4:
        route_danger_level = "Alto"
        route_desc = f"¡Alerta! Ruta pasa por zonas con clima severo o inundación. Zonas detectadas: {len(intersected_zones)}."
    elif route_danger_score >= 3:
        route_danger_level = "Medio"
        route_desc = f"Ruta transitable pero con {len(intersected_zones)} zonas de clima inestable."
    else:
        route_danger_level = "Bajo (Segura)"
        route_desc = "Ruta segura. Evita tormentas activas y zonas climáticas de alto riesgo."

    route_data["safety_assessment"] = {
        "dest_danger_level": dest_danger_level,
        "dest_danger_score": dest_danger_score,
        "dest_description": dest_desc,
        "route_danger_level": route_danger_level,
        "route_danger_score": route_danger_score,
        "route_description": route_desc,
        "comunas": comunas_nombres
    }

    return route_data
