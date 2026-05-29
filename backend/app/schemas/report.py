from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.models.report import ReportType, ReportStatus


class ReportBase(BaseModel):
    type: ReportType
    description: Optional[str] = None
    latitude: float
    longitude: float


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    status: ReportStatus


class ReportInDBBase(ReportBase):
    id: UUID
    reporter_id: Optional[UUID] = None
    status: ReportStatus
    created_at: datetime

    class Config:
        from_attributes = True


class Report(ReportInDBBase):
    pass
