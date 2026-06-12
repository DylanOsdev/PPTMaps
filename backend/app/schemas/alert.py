from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.alert import AlertSeverity


class AlertCreate(BaseModel):
    type: str
    message: str
    severity: AlertSeverity = AlertSeverity.INFO


class AlertUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    severity: Optional[AlertSeverity] = None
    message: Optional[str] = None


class Alert(BaseModel):
    id: UUID
    type: str
    severity: AlertSeverity
    message: str
    is_resolved: bool
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
