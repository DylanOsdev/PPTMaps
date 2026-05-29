from datetime import datetime
from typing import Optional, List, Tuple
from pydantic import BaseModel, ConfigDict

class AccidentZoneBase(BaseModel):
    name: Optional[str] = None
    severity: int
    incident_count: int = 0
    # Simplified multipolygon representation for input
    coordinates: List[List[List[Tuple[float, float]]]]

class AccidentZoneCreate(AccidentZoneBase):
    pass

class AccidentZoneUpdate(BaseModel):
    name: Optional[str] = None
    severity: Optional[int] = None
    incident_count: Optional[int] = None

class AccidentZoneInDBBase(BaseModel):
    id: int
    name: Optional[str]
    severity: int
    incident_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AccidentZone(AccidentZoneInDBBase):
    pass
