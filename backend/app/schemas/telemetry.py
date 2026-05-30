from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator
from geoalchemy2.shape import to_shape


class TelemetryCreate(BaseModel):
    vehicle_id: UUID
    lat: float
    lng: float
    speed: Optional[float] = None
    heading: Optional[float] = None
    timestamp: datetime


class TelemetryBulkCreate(BaseModel):
    pings: list[TelemetryCreate]


class Telemetry(BaseModel):
    id: UUID
    vehicle_id: UUID
    lat: float
    lng: float
    speed: Optional[float] = None
    heading: Optional[float] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def _extract_lat_lng(cls, data):
        # Prefer explicit latitude/longitude columns; fall back to geom.
        lat = getattr(data, "latitude", None)
        lng = getattr(data, "longitude", None)
        if lat is not None and lng is not None:
            object.__setattr__(data, "lat", lat)
            object.__setattr__(data, "lng", lng)
        else:
            geom = getattr(data, "geom", None) or getattr(data, "location", None)
            if geom is not None:
                point = to_shape(geom)
                object.__setattr__(data, "lat", point.y)
                object.__setattr__(data, "lng", point.x)
        return data
