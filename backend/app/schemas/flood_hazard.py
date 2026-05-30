from datetime import datetime
from typing import Optional, List, Tuple
from pydantic import BaseModel, ConfigDict, model_validator
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
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

class FloodHazard(FloodHazardInDBBase):
    pass
