from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.report import ReportType

class ReportBase(BaseModel):
    reporter_id: Optional[int] = None
    report_type: ReportType
    description: Optional[str] = None
    latitude: float
    longitude: float

class ReportCreate(ReportBase):
    pass

class ReportUpdate(BaseModel):
    report_type: Optional[ReportType] = None
    description: Optional[str] = None

class ReportInDBBase(ReportBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Report(ReportInDBBase):
    pass
