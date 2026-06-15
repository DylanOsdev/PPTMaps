import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_X, ST_Y
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.flood_hazard import FloodHazard, FloodStatus
from app.models.accident_zone import AccidentZone

logger = logging.getLogger(__name__)

SIATA_NIVELES_URL = "https://siata.gov.co/sitio_web/index.php/?r=site/getNiveles"

SEED_FLOOD_ZONES = [
    {"name": "Quebrada La Iguaná - Sector Aguas Frías", "station": "Q001", "status": "watch", "level": 1.8,
     "coords": [[[-75.612, 6.278], [-75.600, 6.282], [-75.595, 6.275], [-75.608, 6.270], [-75.612, 6.278]]]},
    {"name": "Quebrada Santa Elena - Sector Barrio Villa Hermosa", "station": "Q002", "status": "dry", "level": 0.6,
     "coords": [[[-75.548, 6.230], [-75.540, 6.235], [-75.535, 6.228], [-75.545, 6.222], [-75.548, 6.230]]]},
    {"name": "Río Medellín - Sector La Mota", "station": "R001", "status": "watch", "level": 2.1,
     "coords": [[[-75.582, 6.202], [-75.575, 6.208], [-75.570, 6.202], [-75.578, 6.195], [-75.582, 6.202]]]},
    {"name": "Quebrada La Hueso - Sector Castilla", "station": "Q003", "status": "flooded", "level": 2.5,
     "coords": [[[-75.590, 6.265], [-75.582, 6.270], [-75.576, 6.263], [-75.584, 6.257], [-75.590, 6.265]]]},
    {"name": "Quebrada La Presidenta - Sector El Poblado", "station": "Q004", "status": "dry", "level": 0.4,
     "coords": [[[-75.565, 6.215], [-75.558, 6.220], [-75.552, 6.212], [-75.562, 6.208], [-75.565, 6.215]]]},
]

async def seed_flood_zones(db: AsyncSession) -> int:
    count = 0
    for z in SEED_FLOOD_ZONES:
        existing = await db.execute(
            select(FloodHazard).where(FloodHazard.siata_station_id == z["station"])
        )
        if not existing.scalar_one_or_none():
            from geoalchemy2 import WKTElement
            poly_wkt = f"POLYGON(({' ,'.join(f'{c[0]} {c[1]}' for c in z['coords'][0])}))"
            zone = FloodHazard(
                name=z["name"],
                siata_station_id=z["station"],
                status=FloodStatus(z["status"]),
                water_level_m=z["level"],
                geom=WKTElement(poly_wkt, srid=4326),
            )
            db.add(zone)
            count += 1
    if count:
        await db.commit()
        logger.info("Flood seed: %d zonas sembradas", count)
    return count

async def run_ingestion(db: AsyncSession):
    await seed_flood_zones(db)
