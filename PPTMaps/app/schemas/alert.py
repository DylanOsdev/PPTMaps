from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.models.alert import AlertSeverity

class AlertBase(BaseModel):
    vehicle_id: Optional[UUID] = None
    type: str
    severity: AlertSeverity = AlertSeverity.INFO
    message: str
    is_resolved: bool = False

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    is_resolved: bool
    resolved_at: Optional[datetime] = None

class AlertInDBBase(AlertBase):
    id: UUID
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Alert(AlertInDBBase):
    pass
