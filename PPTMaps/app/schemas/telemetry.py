from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class TelemetryBase(BaseModel):
    vehicle_id: UUID
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    latitude: float
    longitude: float
    speed: Optional[float] = None
    heading: Optional[float] = None

class TelemetryCreate(TelemetryBase):
    pass

class TelemetryInDBBase(TelemetryBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class Telemetry(TelemetryInDBBase):
    pass

class TelemetryBulkCreate(BaseModel):
    data: List[TelemetryCreate]
