from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


async def create_vehicle(db: AsyncSession, vehicle_in: VehicleCreate) -> Vehicle:
    db_vehicle = Vehicle(**vehicle_in.model_dump())
    db.add(db_vehicle)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle


async def get_vehicle(db: AsyncSession, vehicle_id: UUID) -> Optional[Vehicle]:
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    return result.scalar_one_or_none()


async def get_vehicle_by_plate(db: AsyncSession, plate: str) -> Optional[Vehicle]:
    result = await db.execute(select(Vehicle).where(Vehicle.plate == plate))
    return result.scalar_one_or_none()


async def get_vehicles(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Vehicle]:
    result = await db.execute(select(Vehicle).offset(skip).limit(limit))
    return result.scalars().all()


async def update_vehicle(db: AsyncSession, vehicle_id: UUID, vehicle_in: VehicleUpdate) -> Optional[Vehicle]:
    db_vehicle = await get_vehicle(db, vehicle_id)
    if not db_vehicle:
        return None
    for field, value in vehicle_in.model_dump(exclude_unset=True).items():
        setattr(db_vehicle, field, value)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle


async def delete_vehicle(db: AsyncSession, vehicle_id: UUID) -> bool:
    db_vehicle = await get_vehicle(db, vehicle_id)
    if not db_vehicle:
        return False
    await db.delete(db_vehicle)
    await db.commit()
    return True
