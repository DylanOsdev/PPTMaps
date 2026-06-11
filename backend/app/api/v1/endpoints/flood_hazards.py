from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_flood_hazard
from app.db.database import get_db
from app.schemas.flood_hazard import FloodHazard, FloodHazardCreate, FloodHazardUpdate

router = APIRouter()


@router.get("/", response_model=List[FloodHazard], summary="Listar riesgos de inundación")
async def list_hazards(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    return await crud_flood_hazard.get_flood_hazards(db, skip=skip, limit=limit)


@router.get("/nearby", response_model=List[FloodHazard], summary="Riesgos cercanos (PostGIS)")
async def nearby_hazards(lat: float, lng: float, radius_m: float = 1000, db: AsyncSession = Depends(get_db)):
    return await crud_flood_hazard.get_flood_hazards_nearby(db, lat=lat, lng=lng, radius_m=radius_m)


@router.get("/{hazard_id}", response_model=FloodHazard, summary="Obtener un riesgo de inundación")
async def get_hazard(hazard_id: int, db: AsyncSession = Depends(get_db)):
    hazard = await crud_flood_hazard.get_flood_hazard(db, hazard_id=hazard_id)
    if not hazard:
        raise HTTPException(status_code=404, detail="Riesgo no encontrado")
    return hazard


@router.post("/", response_model=FloodHazard, status_code=201, summary="Crear riesgo de inundación (público)")
async def create_hazard(
    hazard_in: FloodHazardCreate,
    db: AsyncSession = Depends(get_db),
):
    """Crea un riesgo de inundación. Endpoint público."""
    return await crud_flood_hazard.create_flood_hazard(db, hazard_in=hazard_in)


@router.put("/{hazard_id}", response_model=FloodHazard, summary="Actualizar estado de inundación (público)")
async def update_hazard(
    hazard_id: int,
    hazard_in: FloodHazardUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un riesgo de inundación. Endpoint público."""
    hazard = await crud_flood_hazard.update_flood_hazard(db, hazard_id=hazard_id, hazard_in=hazard_in)
    if not hazard:
        raise HTTPException(status_code=404, detail="Riesgo no encontrado")
    return hazard
