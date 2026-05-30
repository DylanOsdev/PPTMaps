"""Seed de zonas (comunas + municipios) desde el JSON del frontend a PostGIS.

parse_zones es una función pura (testeable sin BD) que normaliza el JSON. import_zones
persiste cada zona con upsert por (kind, slug), convirtiendo la geometría GeoJSON a
geom PostGIS con ST_GeomFromGeoJSON.
"""
import json
import logging
from typing import List

from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_SetSRID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.zone import Zone

logger = logging.getLogger(__name__)

# Ruta del JSON fuente (lo mantiene el frontend; el backend lo importa una vez).
DEFAULT_JSON_PATH = "../frontend/public/assets/data/medellin-comunas.json"


def _center(item: dict):
    c = item.get("center") or [None, None]
    return (c[0] if len(c) > 0 else None, c[1] if len(c) > 1 else None)


def parse_zones(data: dict) -> List[dict]:
    """Extrae una lista normalizada de zonas del JSON. Función pura (sin BD)."""
    zones: List[dict] = []
    for c in data.get("comunas", []):
        lat, lng = _center(c)
        zones.append({
            "kind": "comuna",
            "name": c["name"],
            "slug": c["slug"],
            "number": c.get("number"),
            "center_lat": lat,
            "center_lng": lng,
            "color": None,
            "geometry": c["geojson"]["geometry"],
        })
    for m in data.get("municipios", []):
        lat, lng = _center(m)
        zones.append({
            "kind": "municipio",
            "name": m["name"],
            "slug": m["slug"],
            "number": None,
            "center_lat": lat,
            "center_lng": lng,
            "color": m.get("color"),
            "geometry": m["geojson"]["geometry"],
        })
    return zones


async def import_zones(db: AsyncSession, data: dict) -> int:
    """Importa/actualiza las zonas en PostGIS (upsert por kind+slug). Devuelve cuántas."""
    records = parse_zones(data)
    for r in records:
        geom = ST_SetSRID(ST_GeomFromGeoJSON(json.dumps(r["geometry"])), 4326)
        existing = (
            await db.execute(
                select(Zone).where(Zone.kind == r["kind"], Zone.slug == r["slug"])
            )
        ).scalar_one_or_none()
        if existing is None:
            existing = Zone(kind=r["kind"], slug=r["slug"])
            db.add(existing)
        existing.name = r["name"]
        existing.number = r["number"]
        existing.center_lat = r["center_lat"]
        existing.center_lng = r["center_lng"]
        existing.color = r["color"]
        existing.geom = geom
        await db.flush()
    await db.commit()
    return len(records)


async def seed_zones_on_startup(db: AsyncSession, path: str = DEFAULT_JSON_PATH) -> int:
    """Siembra zonas al arrancar: idempotente (skip si ya hay) y resiliente (no rompe si falta el JSON)."""
    existing = (await db.execute(select(func.count()).select_from(Zone))).scalar_one()
    if existing:
        return 0
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Seed de zonas omitido: no se pudo leer %s (%s)", path, e)
        return 0
    return await import_zones(db, data)
