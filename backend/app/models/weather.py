from sqlalchemy import Column, DateTime, Float, Integer, String, Index
from sqlalchemy.sql import func
from geoalchemy2 import Geometry

from app.db.base_class import Base


class WeatherSnapshot(Base):
    """Última lectura de clima/lluvia por punto del Valle de Aburrá (fuente Open-Meteo)."""

    __tablename__ = "weather_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String(120), unique=True, index=True, nullable=False)
    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    temperature_c = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    rain_mm = Column(Float, nullable=True)
    precipitation_prob_2h = Column(Integer, nullable=True)
    weather_code = Column(Integer, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


Index("idx_weather_snapshots_geom", WeatherSnapshot.geom, postgresql_using="gist")
