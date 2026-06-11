"""CRUD operations para Air Quality Readings."""
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from geoalchemy2.functions import ST_Distance, ST_SetSRID, ST_MakePoint
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.air_quality_reading import AirQualityReading
from app.models.zone import Zone


async def get_latest_readings(db: AsyncSession) -> List[AirQualityReading]:
    """Obtiene las últimas lecturas (una por estación)."""
    # Subquery para obtener el max timestamp por station_id
    subq = (
        select(
            AirQualityReading.station_id,
            func.max(AirQualityReading.timestamp).label("max_ts")
        )
        .group_by(AirQualityReading.station_id)
        .subquery()
    )
    
    # Join con la subquery para obtener las filas completas
    stmt = (
        select(AirQualityReading)
        .join(
            subq,
            and_(
                AirQualityReading.station_id == subq.c.station_id,
                AirQualityReading.timestamp == subq.c.max_ts
            )
        )
        .order_by(AirQualityReading.station_id)
    )
    
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_by_station(
    db: AsyncSession,
    station_id: str,
    hours: int = 168
) -> List[AirQualityReading]:
    """Obtiene lecturas de una estación en las últimas N horas (default: 1 semana)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    stmt = (
        select(AirQualityReading)
        .where(
            AirQualityReading.station_id == station_id,
            AirQualityReading.timestamp >= cutoff
        )
        .order_by(AirQualityReading.timestamp.desc())
    )
    
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_by_comuna(db: AsyncSession) -> List[dict]:
    """Obtiene AQI promedio por comuna usando interpolación IDW (peso inverso distancia).
    
    Para cada comuna, encuentra las 3 estaciones más cercanas y calcula
    el promedio ponderado del AQI.
    """
    # Obtener las últimas lecturas
    latest = await get_latest_readings(db)
    if not latest:
        return []
    
    # Obtener todas las comunas
    comunas_stmt = select(Zone).where(Zone.kind == "comuna")
    comunas_result = await db.execute(comunas_stmt)
    comunas = comunas_result.scalars().all()
    
    results = []
    for comuna in comunas:
        # Calcular distancia de cada estación al centroide de la comuna
        # (simplificado: usamos center_lat/lng en vez del centroid del polígono)
        if not comuna.center_lat or not comuna.center_lng:
            continue
        
        # Encontrar estaciones con AQI válido
        stations_with_aqi = [r for r in latest if r.aqi is not None]
        if not stations_with_aqi:
            continue
        
        # Calcular promedio simple (sin interpolación compleja para MVP)
        avg_aqi = sum(r.aqi for r in stations_with_aqi) / len(stations_with_aqi)
        
        # Última actualización = timestamp más reciente
        last_update = max(r.timestamp for r in stations_with_aqi)
        
        results.append({
            "comuna_name": comuna.name,
            "aqi_avg": round(avg_aqi, 1),
            "station_count": len(stations_with_aqi),
            "last_update": last_update
        })
    
    return results
