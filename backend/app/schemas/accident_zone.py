from datetime import datetime
from typing import Optional, List, Tuple
from pydantic import BaseModel, ConfigDict, model_validator
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping

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
    geometry: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def _extract_geometry(cls, data):
        geom = getattr(data, "geom", None)
        if geom is not None:
            object.__setattr__(data, "geometry", mapping(to_shape(geom)))
        return data

class AccidentZone(AccidentZoneInDBBase):
    pass
