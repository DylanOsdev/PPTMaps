import uuid
import enum
from sqlalchemy import Column, String, Enum, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class AlertSeverity(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True, index=True)
    
    type = Column(String, nullable=False) # e.g. "OVERSPEED", "IDLE", "GEOFENCE_EXIT"
    severity = Column(Enum(AlertSeverity), default=AlertSeverity.INFO, nullable=False)
    message = Column(String, nullable=False)
    is_resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    vehicle = relationship("Vehicle")
