import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

class VehicleStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    IN_MAINTENANCE = "IN_MAINTENANCE"
    ON_MISSION = "ON_MISSION"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    plate = Column(String, unique=True, index=True, nullable=False)
    model = Column(String, nullable=True)
    type = Column(String, nullable=False)
    status = Column(Enum(VehicleStatus, name="vehiclestatus"), nullable=False, default=VehicleStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
