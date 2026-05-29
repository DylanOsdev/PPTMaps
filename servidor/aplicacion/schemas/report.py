from typing import Literal

from pydantic import BaseModel, Field

ReportType = Literal["collision", "flood", "obstacle", "pothole"]


class ReportCreate(BaseModel):
    type: ReportType
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    description: str | None = None


class ReportRead(BaseModel):
    id: int
    type: ReportType
    lat: float
    lng: float
    status: str
