from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate

async def get_vehicle(db: AsyncSession, vehicle_id: UUID) -> Optional[Vehicle]:
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    return result.scalar_one_or_none()

async def get_vehicle_by_plate(db: AsyncSession, plate: str) -> Optional[Vehicle]:
    result = await db.execute(select(Vehicle).where(Vehicle.plate == plate))
    return result.scalar_one_or_none()

async def get_vehicles(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Vehicle]:
    result = await db.execute(select(Vehicle).offset(skip).limit(limit))
    return result.scalars().all()

async def create_vehicle(db: AsyncSession, vehicle_in: VehicleCreate) -> Vehicle:
    db_vehicle = Vehicle(**vehicle_in.model_dump())
    db.add(db_vehicle)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle

async def update_vehicle(db: AsyncSession, db_vehicle: Vehicle, vehicle_in: VehicleUpdate) -> Vehicle:
    update_data = vehicle_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_vehicle, field, value)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle

async def delete_vehicle(db: AsyncSession, vehicle_id: UUID) -> Optional[Vehicle]:
    vehicle = await get_vehicle(db, vehicle_id)
    if vehicle:
        await db.delete(vehicle)
        await db.commit()
    return vehicle
