from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, model_validator
from geoalchemy2.shape import to_shape
from app.models.report import ReportType


class ReportCreate(BaseModel):
    report_type: ReportType
    description: Optional[str] = None
    latitude: float
    longitude: float
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None  # Sin validación especial


class ReportUpdate(BaseModel):
    report_type: Optional[ReportType] = None
    description: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None


class Report(BaseModel):
    id: int
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    report_type: ReportType
    description: Optional[str] = None
    latitude: float
    longitude: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def _extract_lat_lon(cls, data):
        # Derive latitude/longitude from the PostGIS POINT geom on the ORM object.
        geom = getattr(data, "geom", None)
        if geom is not None:
            point = to_shape(geom)
            object.__setattr__(data, "latitude", point.y)
            object.__setattr__(data, "longitude", point.x)
        return data
