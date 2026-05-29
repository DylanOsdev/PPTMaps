from datetime import datetime
from typing import Optional, List, Tuple
from pydantic import BaseModel, ConfigDict
from app.models.flood_hazard import FloodStatus

class FloodHazardBase(BaseModel):
    name: str
    siata_station_id: Optional[str] = None
    status: FloodStatus = FloodStatus.dry
    water_level_m: Optional[float] = None
    # Simplified polygon representation
    coordinates: List[List[Tuple[float, float]]]

class FloodHazardCreate(FloodHazardBase):
    pass

class FloodHazardUpdate(BaseModel):
    status: Optional[FloodStatus] = None
    water_level_m: Optional[float] = None

class FloodHazardInDBBase(BaseModel):
    id: int
    name: str
    siata_station_id: Optional[str]
    status: FloodStatus
    water_level_m: Optional[float]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FloodHazard(FloodHazardInDBBase):
    pass
