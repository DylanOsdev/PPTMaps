from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base_class import Base
import uuid

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_telemetry_location", "location", postgresql_using="gist"),
    )
