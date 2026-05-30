import logging
from typing import Optional, Dict, Any
from datetime import datetime

import httpx
from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.flood_hazard import FloodHazard, FloodStatus

logger = logging.getLogger(__name__)

SIATA_API_BASE = "https://siata.gov.co/sitio_web/index.php"
SIATA_NIVELES_URL = f"{SIATA_API_BASE}/?r=site/getNiveles"
SIATA_LLUVIA_URL = f"{SIATA_API_BASE}/?r=site/getLluvia"

STATIONS_FALLBACK = [
    {"id": "Q001", "name": "Quebrada La Iguaná", "lat": 6.278, "lng": -75.605,
     "polygon": "POLYGON((-75.612 6.278, -75.600 6.282, -75.595 6.275, -75.608 6.270, -75.612 6.278))"},
    {"id": "Q002", "name": "Quebrada Santa Elena", "lat": 6.230, "lng": -75.540,
     "polygon": "POLYGON((-75.548 6.230, -75.540 6.235, -75.535 6.228, -75.545 6.222, -75.548 6.230))"},
    {"id": "R001", "name": "Río Medellín - La Mota", "lat": 6.202, "lng": -75.575,
     "polygon": "POLYGON((-75.582 6.202, -75.575 6.208, -75.570 6.202, -75.578 6.195, -75.582 6.202))"},
    {"id": "Q003", "name": "Quebrada La Hueso", "lat": 6.265, "lng": -75.585,
     "polygon": "POLYGON((-75.590 6.265, -75.582 6.270, -75.576 6.263, -75.584 6.257, -75.590 6.265))"},
    {"id": "Q004", "name": "Quebrada La Presidenta", "lat": 6.215, "lng": -75.560,
     "polygon": "POLYGON((-75.565 6.215, -75.558 6.220, -75.552 6.212, -75.562 6.208, -75.565 6.215))"},
]

async def fetch_siata_niveles() -> list:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(SIATA_NIVELES_URL)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
                logger.warning(f"SIATA niveles: formato inesperado")
            else:
                logger.warning(f"SIATA niveles HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"SIATA niveles error: {e}")
    return []

async def sync_flood_hazards(db: AsyncSession) -> int:
    count = 0
    siata_data = await fetch_siata_niveles()

    if siata_data:
        for item in siata_data:
            station_id = item.get("estacion") or item.get("id") or item.get("station")
            nivel = item.get("nivel") or item.get("level") or item.get("valor")
            if not station_id:
                continue

            existing = await db.execute(
                select(FloodHazard).where(FloodHazard.siata_station_id == station_id)
            )
            zone = existing.scalar_one_or_none()
            if zone:
                if nivel is not None:
                    zone.water_level_m = float(nivel)
                    zone.status = _determine_status(float(nivel))
                    zone.updated_at = datetime.utcnow()
                    count += 1
            else:
                station_info = next((s for s in STATIONS_FALLBACK if s["id"] == station_id), None)
                if station_info:
                    level = float(nivel) if nivel is not None else 0.5
                    zone = FloodHazard(
                        name=station_info["name"],
                        siata_station_id=station_id,
                        status=_determine_status(level),
                        water_level_m=level,
                        geom=WKTElement(station_info["polygon"], srid=4326),
                    )
                    db.add(zone)
                    count += 1
    else:
        for st in STATIONS_FALLBACK:
            existing = await db.execute(
                select(FloodHazard).where(FloodHazard.siata_station_id == st["id"])
            )
            if not existing.scalar_one_or_none():
                zone = FloodHazard(
                    name=st["name"],
                    siata_station_id=st["id"],
                    status=FloodStatus.dry,
                    water_level_m=0.5,
                    geom=WKTElement(st["polygon"], srid=4326),
                )
                db.add(zone)
                count += 1

    if count:
        await db.commit()
        logger.info(f"SIATA sync: {count} zonas actualizadas")
    return count

def _determine_status(level: float) -> FloodStatus:
    if level >= 2.0:
        return FloodStatus.flooded
    elif level >= 1.2:
        return FloodStatus.watch
    return FloodStatus.dry
