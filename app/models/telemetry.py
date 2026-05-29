import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base import Base

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False, index=True)
    
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, nullable=True) # km/h
    heading = Column(Float, nullable=True) # degrees
    
    # PostGIS geometry column for spatial queries
    # SRID 4326 is standard WGS84 longitude/latitude
    location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vehicle = relationship("Vehicle")

# Create a spatial index for the location column
Index('idx_telemetry_location', Telemetry.location, postgresql_using='gist')
