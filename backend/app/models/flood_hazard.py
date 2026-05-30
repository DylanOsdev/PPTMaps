from datetime import datetime
import enum
from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Index
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base_class import Base

class FloodStatus(str, enum.Enum):
    dry = "dry"
    watch = "watch"
    flooded = "flooded"

class FloodHazard(Base):
    __tablename__ = "flood_hazards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    siata_station_id = Column(String(64), index=True, nullable=True)
    status = Column(Enum(FloodStatus, name="flood_status"), nullable=False, default=FloodStatus.dry)
    water_level_m = Column(Float, nullable=True)
    geom = Column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


Index("idx_flood_hazards_geom", FloodHazard.geom, postgresql_using="gist")
