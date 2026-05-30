from typing import List, Optional

from geoalchemy2 import Geography
from geoalchemy2.functions import ST_DWithin, ST_SetSRID, ST_MakePoint
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import select, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accident_zone import AccidentZone
from app.schemas.accident_zone import AccidentZoneCreate


def _to_multipolygon(coordinates) -> MultiPolygon:
    """coordinates: List[polygon], polygon: List[ring], ring: List[(lng, lat)]."""
    polygons = [Polygon(poly[0], poly[1:]) for poly in coordinates]
    return from_shape(MultiPolygon(polygons), srid=4326)


async def create_accident_zone(db: AsyncSession, zone_in: AccidentZoneCreate) -> AccidentZone:
    db_zone = AccidentZone(
        name=zone_in.name,
        severity=zone_in.severity,
        incident_count=zone_in.incident_count,
        geom=_to_multipolygon(zone_in.coordinates),
    )
    db.add(db_zone)
    await db.commit()
    await db.refresh(db_zone)
    return db_zone


async def get_accident_zones(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[AccidentZone]:
    result = await db.execute(select(AccidentZone).offset(skip).limit(limit))
    return result.scalars().all()


async def get_accident_zone(db: AsyncSession, zone_id: int) -> Optional[AccidentZone]:
    result = await db.execute(select(AccidentZone).where(AccidentZone.id == zone_id))
    return result.scalar_one_or_none()


async def get_accident_zones_nearby(
    db: AsyncSession, lat: float, lng: float, radius_m: float
) -> List[AccidentZone]:
    point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    # Cast a geography para medir la distancia en metros (en SRID 4326 sería en grados).
    result = await db.execute(
        select(AccidentZone).where(
            ST_DWithin(cast(AccidentZone.geom, Geography), cast(point, Geography), radius_m)
        )
    )
    return result.scalars().all()
