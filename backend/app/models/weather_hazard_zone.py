"""Modelo de zonas de peligro climático (tormentas, rayos, granizo)."""
from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry

from app.db.base_class import Base


class WeatherHazardZone(Base):
    __tablename__ = "weather_hazard_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    severity = Column(Integer, default=1)  # 1=bajo, 5=crítico
    event_count = Column(Integer, default=0)  # Cantidad de eventos climáticos en la zona
    geom = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False)
