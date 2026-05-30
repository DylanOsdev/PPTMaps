from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator
from geoalchemy2.shape import to_shape


class TelemetryPingCreate(BaseModel):
    device_id: str
    lat: float
    lng: float
    speed_kmh: Optional[float] = None
    recorded_at: datetime


class TelemetryPing(BaseModel):
    id: int
    device_id: str
    lat: float
    lng: float
    speed_kmh: Optional[float] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def _extract_lat_lng(cls, data):
        geom = getattr(data, "geom", None)
        if geom is not None:
            point = to_shape(geom)
            object.__setattr__(data, "lat", point.y)
            object.__setattr__(data, "lng", point.x)
        return data
