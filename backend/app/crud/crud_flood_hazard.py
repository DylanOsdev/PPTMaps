from typing import List, Optional

from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin, ST_SetSRID, ST_MakePoint
from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon
from sqlalchemy import select, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.flood_hazard import FloodHazard
from app.schemas.flood_hazard import FloodHazardCreate, FloodHazardUpdate


def _to_polygon(coordinates) -> Polygon:
    """coordinates: List[ring], ring: List[(lng, lat)]. El primer anillo es el exterior."""
    return from_shape(Polygon(coordinates[0], coordinates[1:]), srid=4326)


async def create_flood_hazard(db: AsyncSession, hazard_in: FloodHazardCreate) -> FloodHazard:
    db_hazard = FloodHazard(
        name=hazard_in.name,
        siata_station_id=hazard_in.siata_station_id,
        status=hazard_in.status,
        water_level_m=hazard_in.water_level_m,
        geom=_to_polygon(hazard_in.coordinates),
    )
    db.add(db_hazard)
    await db.commit()
    await db.refresh(db_hazard)
    return db_hazard


async def get_flood_hazards(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[FloodHazard]:
    result = await db.execute(select(FloodHazard).offset(skip).limit(limit))
    return result.scalars().all()


async def get_flood_hazard(db: AsyncSession, hazard_id: int) -> Optional[FloodHazard]:
    result = await db.execute(select(FloodHazard).where(FloodHazard.id == hazard_id))
    return result.scalar_one_or_none()


async def update_flood_hazard(
    db: AsyncSession, hazard_id: int, hazard_in: FloodHazardUpdate
) -> Optional[FloodHazard]:
    db_hazard = await get_flood_hazard(db, hazard_id)
    if not db_hazard:
        return None
    for field, value in hazard_in.model_dump(exclude_unset=True).items():
        setattr(db_hazard, field, value)
    await db.commit()
    await db.refresh(db_hazard)
    return db_hazard


async def get_flood_hazards_nearby(
    db: AsyncSession, lat: float, lng: float, radius_m: float
) -> List[FloodHazard]:
    point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    result = await db.execute(
        select(FloodHazard).where(
            ST_DWithin(cast(FloodHazard.geom, Geography), cast(point, Geography), radius_m)
        )
    )
    return result.scalars().all()


async def upsert_flood_hazard_by_station(
    db: AsyncSession,
    siata_station_id: str,
    name: str,
    status,
    water_level_m: float,
    geom,
) -> FloodHazard:
    """Crea o actualiza un hazard identificado por su estación SIATA (idempotente)."""
    result = await db.execute(
        select(FloodHazard).where(FloodHazard.siata_station_id == siata_station_id)
    )
    hazard = result.scalar_one_or_none()
    if hazard is None:
        hazard = FloodHazard(siata_station_id=siata_station_id, name=name, geom=geom)
        db.add(hazard)
    hazard.status = status
    hazard.water_level_m = water_level_m
    await db.commit()
    await db.refresh(hazard)
    return hazard
