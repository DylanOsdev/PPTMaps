from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, require_role
from app.crud import get_vehicle, get_vehicles, create_vehicle, update_vehicle, delete_vehicle, get_vehicle_by_plate
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.vehicle import Vehicle, VehicleCreate, VehicleUpdate

router = APIRouter()

@router.get("/", response_model=List[Vehicle], summary="Listar vehículos")
async def list_vehicles(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await get_vehicles(db, skip=skip, limit=limit)

@router.post("/", response_model=Vehicle, status_code=status.HTTP_201_CREATED, summary="Crear vehículo")
async def create_vehicle_endpoint(
    vehicle_in: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.authority)),
):
    existing = await get_vehicle_by_plate(db, plate=vehicle_in.plate)
    if existing:
        raise HTTPException(status_code=400, detail="La placa ya está registrada")
    return await create_vehicle(db, vehicle_in=vehicle_in)

@router.get("/{vehicle_id}", response_model=Vehicle, summary="Obtener vehículo por ID")
async def get_vehicle_endpoint(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    vehicle = await get_vehicle(db, vehicle_id=vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return vehicle

@router.put("/{vehicle_id}", response_model=Vehicle, summary="Actualizar vehículo")
async def update_vehicle_endpoint(
    vehicle_id: UUID,
    vehicle_in: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.authority)),
):
    vehicle = await get_vehicle(db, vehicle_id=vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return await update_vehicle(db, db_vehicle=vehicle, vehicle_in=vehicle_in)

@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar vehículo")
async def delete_vehicle_endpoint(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    vehicle = await delete_vehicle(db, vehicle_id=vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
