from typing import List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID, ST_DWithin, ST_AsGeoJSON
from app.models.telemetry import Telemetry
from app.schemas.telemetry import TelemetryCreate

async def create_telemetry(db: AsyncSession, telemetry_in: TelemetryCreate) -> Telemetry:
    """Crea un registro de telemetría con punto PostGIS."""
    point = ST_SetSRID(ST_MakePoint(telemetry_in.longitude, telemetry_in.latitude), 4326)
    db_telemetry = Telemetry(
        vehicle_id=telemetry_in.vehicle_id,
        timestamp=telemetry_in.timestamp,
        latitude=telemetry_in.latitude,
        longitude=telemetry_in.longitude,
        speed=telemetry_in.speed,
        heading=telemetry_in.heading,
        location=point,
    )
    db.add(db_telemetry)
    await db.commit()
    await db.refresh(db_telemetry)
    return db_telemetry

async def bulk_create_telemetry(db: AsyncSession, items: List[TelemetryCreate]) -> int:
    """Ingesta masiva de telemetría."""
    objects = []
    for item in items:
        point = ST_SetSRID(ST_MakePoint(item.longitude, item.latitude), 4326)
        objects.append(Telemetry(
            vehicle_id=item.vehicle_id,
            timestamp=item.timestamp,
            latitude=item.latitude,
            longitude=item.longitude,
            speed=item.speed,
            heading=item.heading,
            location=point,
        ))
    db.add_all(objects)
    await db.commit()
    return len(objects)

async def get_telemetry(
    db: AsyncSession,
    vehicle_id: Optional[UUID] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 200,
) -> List[Telemetry]:
    """Consulta telemetría con filtros opcionales."""
    query = select(Telemetry).order_by(desc(Telemetry.timestamp))
    if vehicle_id:
        query = query.where(Telemetry.vehicle_id == vehicle_id)
    if start_time:
        query = query.where(Telemetry.timestamp >= start_time)
    if end_time:
        query = query.where(Telemetry.timestamp <= end_time)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

async def get_latest_telemetry_per_vehicle(db: AsyncSession) -> List[Telemetry]:
    """Obtiene el último registro de cada vehículo (útil para dashboards en vivo)."""
    subquery = (
        select(Telemetry.vehicle_id, func.max(Telemetry.timestamp).label("max_ts"))
        .group_by(Telemetry.vehicle_id)
        .subquery()
    )
    query = select(Telemetry).join(
        subquery,
        (Telemetry.vehicle_id == subquery.c.vehicle_id) &
        (Telemetry.timestamp == subquery.c.max_ts)
    )
    result = await db.execute(query)
    return result.scalars().all()

async def get_telemetry_within_radius(
    db: AsyncSession, lat: float, lng: float, radius_meters: float
) -> List[Telemetry]:
    """Consulta espacial: telemetría dentro de un radio geográfico."""
    center = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    query = select(Telemetry).where(
        ST_DWithin(Telemetry.location.cast("geography"), center.cast("geography"), radius_meters)
    ).order_by(desc(Telemetry.timestamp)).limit(500)
    result = await db.execute(query)
    return result.scalars().all()
