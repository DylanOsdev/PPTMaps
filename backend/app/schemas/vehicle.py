from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.vehicle import VehicleStatus


class VehicleCreate(BaseModel):
    plate: str
    model: Optional[str] = None
    type: str
    status: VehicleStatus = VehicleStatus.ACTIVE


class VehicleUpdate(BaseModel):
    model: Optional[str] = None
    type: Optional[str] = None
    status: Optional[VehicleStatus] = None


class Vehicle(BaseModel):
    id: UUID
    plate: str
    model: Optional[str] = None
    type: str
    status: VehicleStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
