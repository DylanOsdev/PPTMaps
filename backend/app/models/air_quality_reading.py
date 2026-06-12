"""Air Quality Reading model - serie temporal de lecturas de estaciones WAQI."""
from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.sql import func
from geoalchemy2 import Geometry

from app.db.base_class import Base


class AirQualityReading(Base):
    """Lectura de calidad del aire de una estación en un momento específico.
    
    Serie temporal append-only. Cada sync crea nuevas filas. Unique constraint
    previene duplicados por (station_id, timestamp).
    """
    __tablename__ = "air_quality_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(20), nullable=False, index=True)
    station_name = Column(String(100), nullable=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    
    # Contaminantes (valores pueden ser NULL si la estación no los reporta)
    aqi = Column(Integer, nullable=True)  # Índice consolidado 0-500
    pm25 = Column(Float, nullable=True)   # µg/m³
    pm10 = Column(Float, nullable=True)
    no2 = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    
    # Datos meteorológicos opcionales
    temp = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    
    # Timestamp de la lectura (de la fuente WAQI)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Timestamp de creación en nuestra BD
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        UniqueConstraint('station_id', 'timestamp', name='uq_station_timestamp'),
    )
    
    @property
    def lat(self) -> float:
        """Extract latitude from PostGIS geometry."""
        from geoalchemy2.shape import to_shape
        point = to_shape(self.geom)
        return point.y
    
    @property
    def lng(self) -> float:
        """Extract longitude from PostGIS geometry."""
        from geoalchemy2.shape import to_shape
        point = to_shape(self.geom)
        return point.x
