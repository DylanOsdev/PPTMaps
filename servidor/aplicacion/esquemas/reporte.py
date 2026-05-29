from typing import Literal

from pydantic import BaseModel, Field

TipoReporte = Literal["collision", "flood", "obstacle", "pothole"]


class ReporteCrear(BaseModel):
    type: TipoReporte
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    description: str | None = None


class ReporteLeer(BaseModel):
    id: int
    type: TipoReporte
    lat: float
    lng: float
    estado: str
