from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.crud import crud_accident_zone
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.accident_zone import AccidentZone, AccidentZoneCreate

router = APIRouter()


@router.get("/", response_model=List[AccidentZone], summary="Listar zonas de accidentalidad")
async def list_zones(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    return await crud_accident_zone.get_accident_zones(db, skip=skip, limit=limit)


@router.get("/nearby", response_model=List[AccidentZone], summary="Zonas cercanas (PostGIS)")
async def nearby_zones(lat: float, lng: float, radius_m: float = 1000, db: AsyncSession = Depends(get_db)):
    return await crud_accident_zone.get_accident_zones_nearby(db, lat=lat, lng=lng, radius_m=radius_m)


@router.get("/{zone_id}", response_model=AccidentZone, summary="Obtener una zona")
async def get_zone(zone_id: int, db: AsyncSession = Depends(get_db)):
    zone = await crud_accident_zone.get_accident_zone(db, zone_id=zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zona no encontrada")
    return zone


@router.post("/", response_model=AccidentZone, status_code=201, summary="Crear zona de accidentalidad")
async def create_zone(
    zone_in: AccidentZoneCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.authority)),
):
    return await crud_accident_zone.create_accident_zone(db, zone_in=zone_in)
