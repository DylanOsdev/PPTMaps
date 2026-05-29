from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime

from app.api.deps import get_current_active_user
from app.db.database import get_db
from app.models.user import User
from app.models.telemetry import Telemetry
from app.models.vehicle import Vehicle
from app.models.alert import Alert

router = APIRouter()

@router.get("/summary", summary="Resumen general de la plataforma")
async def analytics_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Retorna métricas clave: total vehículos, telemetría, alertas activas."""
    total_vehicles = (await db.execute(select(func.count(Vehicle.id)))).scalar()
    total_telemetry = (await db.execute(select(func.count(Telemetry.id)))).scalar()
    active_alerts = (await db.execute(
        select(func.count(Alert.id)).where(Alert.is_resolved == False)
    )).scalar()
    avg_speed_result = (await db.execute(select(func.avg(Telemetry.speed)))).scalar()

    return {
        "total_vehicles": total_vehicles,
        "total_telemetry_records": total_telemetry,
        "active_alerts": active_alerts,
        "average_speed_kmh": round(avg_speed_result, 2) if avg_speed_result else 0,
    }

@router.get("/heatmap", summary="Datos para mapa de calor geoespacial")
async def analytics_heatmap(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 2000,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Retorna coordenadas lat/lng con velocidad para generar heatmap en el frontend."""
    query = select(Telemetry.latitude, Telemetry.longitude, Telemetry.speed)
    if start_time:
        query = query.where(Telemetry.timestamp >= start_time)
    if end_time:
        query = query.where(Telemetry.timestamp <= end_time)
    result = await db.execute(query.order_by(desc(Telemetry.timestamp)).limit(limit))
    rows = result.fetchall()
    return [{"lat": r.latitude, "lng": r.longitude, "speed": r.speed} for r in rows]

@router.get("/speed-stats", summary="Estadísticas de velocidad por vehículo")
async def speed_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Devuelve velocidad mín, máx y promedio por vehículo."""
    result = await db.execute(
        select(
            Telemetry.vehicle_id,
            func.min(Telemetry.speed).label("min_speed"),
            func.max(Telemetry.speed).label("max_speed"),
            func.avg(Telemetry.speed).label("avg_speed"),
            func.count(Telemetry.id).label("records"),
        ).group_by(Telemetry.vehicle_id)
    )
    rows = result.fetchall()
    return [
        {
            "vehicle_id": str(r.vehicle_id),
            "min_speed": round(r.min_speed, 2) if r.min_speed else 0,
            "max_speed": round(r.max_speed, 2) if r.max_speed else 0,
            "avg_speed": round(r.avg_speed, 2) if r.avg_speed else 0,
            "records": r.records,
        }
        for r in rows
    ]
