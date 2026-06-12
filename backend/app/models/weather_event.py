"""Modelo de eventos climáticos históricos (lluvias intensas, rayos, granizo)."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float
from geoalchemy2 import Geometry

from app.db.base_class import Base


class WeatherEvent(Base):
    __tablename__ = "weather_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)  # "rainfall", "lightning", "hail", "storm"
    severity = Column(Integer, default=1)  # 1=leve, 5=severo
    intensity = Column(Float)  # mm/h para lluvia, kA para rayos
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    source = Column(String, default="SIATA")
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
