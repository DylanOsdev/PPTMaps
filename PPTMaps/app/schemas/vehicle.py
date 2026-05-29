from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.models.vehicle import VehicleStatus

class VehicleBase(BaseModel):
    plate: str
    model: Optional[str] = None
    type: str = "Ambulance"
    status: VehicleStatus = VehicleStatus.ACTIVE

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(VehicleBase):
    pass

class VehicleInDBBase(VehicleBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Vehicle(VehicleInDBBase):
    pass
