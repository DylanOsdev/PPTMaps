from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID

from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate

async def create_vehicle(db: AsyncSession, vehicle_in: VehicleCreate) -> Vehicle:
    """Crea un nuevo vehículo en la base de datos."""
    db_vehicle = Vehicle(**vehicle_in.model_dump())
    db.add(db_vehicle)
    await db.commit()
    await db.refresh(db_vehicle)
    return db_vehicle

async def get_vehicles(db: AsyncSession, skip: int = 0, limit: int = 100):
    """Obtiene una lista de vehículos con paginación."""
    result = await db.execute(select(Vehicle).offset(skip).limit(limit))
    return result.scalars().all()

async def get_vehicle_by_id(db: AsyncSession, vehicle_id: UUID) -> Vehicle | None:
    """Obtiene un vehículo específico por su ID."""
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    return result.scalar_one_or_none()
