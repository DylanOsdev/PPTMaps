from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.crud import (
    create_telemetry, bulk_create_telemetry, get_telemetry,
    get_latest_telemetry_per_vehicle, get_telemetry_within_radius
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.telemetry import Telemetry, TelemetryCreate, TelemetryBulkCreate

router = APIRouter()

@router.post("/", response_model=Telemetry, status_code=status.HTTP_201_CREATED, summary="Ingestar un registro GPS")
async def ingest_telemetry(
    telemetry_in: TelemetryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await create_telemetry(db, telemetry_in=telemetry_in)

@router.post("/bulk", status_code=status.HTTP_201_CREATED, summary="Ingesta masiva de GPS")
async def bulk_ingest_telemetry(
    payload: TelemetryBulkCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    count = await bulk_create_telemetry(db, items=payload.data)
    return {"message": f"{count} registros ingresados correctamente"}

@router.get("/", response_model=List[Telemetry], summary="Consultar telemetría con filtros")
async def list_telemetry(
    vehicle_id: Optional[UUID] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await get_telemetry(db, vehicle_id=vehicle_id, start_time=start_time, end_time=end_time, skip=skip, limit=limit)

@router.get("/latest", response_model=List[Telemetry], summary="Última posición de cada vehículo")
async def latest_telemetry(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await get_latest_telemetry_per_vehicle(db)

@router.get("/nearby", response_model=List[Telemetry], summary="Telemetría por proximidad geoespacial")
async def nearby_telemetry(
    lat: float,
    lng: float,
    radius_meters: float = 1000.0,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await get_telemetry_within_radius(db, lat=lat, lng=lng, radius_meters=radius_meters)
