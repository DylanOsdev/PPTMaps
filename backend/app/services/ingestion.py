import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import httpx

from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_DWithin, ST_X, ST_Y
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.report import Report, ReportType
from app.models.flood_hazard import FloodHazard, FloodStatus
from app.models.accident_zone import AccidentZone
from app.crud.crud_report import create_report

logger = logging.getLogger(__name__)

SODA_INCIDENTES_URL = "https://www.datos.gov.co/resource/9wqu-juqb.json"
SIATA_NIVELES_URL = "https://siata.gov.co/sitio_web/index.php/?r=site/getNiveles"

SEED_ACCIDENTS = [
    {"lat": 6.2515, "lng": -75.5635, "desc": "Choque entre dos vehículos en la Avenida Oriental", "type": "accident"},
    {"lat": 6.2398, "lng": -75.5902, "desc": "Atropellamiento de peatón en la Avenida 33", "type": "accident"},
    {"lat": 6.2178, "lng": -75.5705, "desc": "Colisión múltiple en la Autopista Sur", "type": "accident"},
    {"lat": 6.2023, "lng": -75.5623, "desc": "Motociclista lesionado en la Carrera 48", "type": "accident"},
    {"lat": 6.2756, "lng": -75.5387, "desc": "Vehículo volcado en la Regional", "type": "accident"},
    {"lat": 6.1978, "lng": -75.5762, "desc": "Choque por alcance en la Avenida Las Vegas", "type": "accident"},
    {"lat": 6.2675, "lng": -75.5648, "desc": "Accidente en intersección de la Avenida San Juan", "type": "accident"},
    {"lat": 6.2265, "lng": -75.5552, "desc": "Colisión de bus y taxi en el Centro", "type": "accident"},
    {"lat": 6.2489, "lng": -75.5725, "desc": "Peatón arrollado en la Avenida El Poblado", "type": "accident"},
    {"lat": 6.2356, "lng": -75.5489, "desc": "Choque de motocicletas en la Carrera 70", "type": "accident"},
]

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

async def sync_soda_incidents(db: AsyncSession) -> int:
    count = 0
    from app.schemas.report import ReportCreate

    async def _report_exists(lat: float, lng: float, desc: str) -> bool:
        point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        stmt = select(Report).where(
            Report.report_type == ReportType.accident,
            ST_DWithin(Report.geom, point, 0.0001),
            Report.description == desc,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{SODA_INCIDENTES_URL}?$limit=100")
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    for item in data:
                        lat = item.get("latitude") or item.get("lat")
                        lng = item.get("longitude") or item.get("lng")
                        if lat and lng:
                            lat_f, lng_f = float(lat), float(lng)
                            desc = item.get("description", "Sincronizado desde SODA")
                            if await _report_exists(lat_f, lng_f, desc):
                                continue
                            await create_report(db, ReportCreate(
                                report_type=ReportType.accident,
                                description=desc,
                                latitude=lat_f,
                                longitude=lng_f,
                            ))
                            count += 1
                    await db.commit()
                logger.info("SODA sync: %d incidentes importados", count)
            else:
                logger.warning("SODA API responded with %s", resp.status_code)
    except Exception as e:
        logger.warning("SODA API error (fallback to seed): %s", e)

    if count == 0:
        for acc in SEED_ACCIDENTS:
            if await _report_exists(acc["lat"], acc["lng"], acc["desc"]):
                continue
            await create_report(db, ReportCreate(
                report_type=ReportType(acc["type"]),
                description=acc["desc"],
                latitude=acc["lat"],
                longitude=acc["lng"],
                reporter_name="Sistema MEData",
            ))
            count += 1
        if count:
            await db.commit()
        logger.info("Seed data: %d accidentes sembrados", count)

    return count

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
    await sync_soda_incidents(db)
    await seed_flood_zones(db)
