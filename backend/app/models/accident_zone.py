from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base_class import Base

class AccidentZone(Base):
    __tablename__ = "accident_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    severity = Column(Integer, nullable=False)
    incident_count = Column(Integer, nullable=False, default=0)
    geom = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
