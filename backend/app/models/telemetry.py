from sqlalchemy import Column, DateTime, Float, Integer, String, Index
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base_class import Base


class TelemetryPing(Base):
    __tablename__ = "telemetry_pings"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(64), index=True, nullable=False)
    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    speed_kmh = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


Index("idx_telemetry_pings_geom", TelemetryPing.geom, postgresql_using="gist")
