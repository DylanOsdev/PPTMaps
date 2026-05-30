from sqlalchemy import Column, DateTime, Float, Integer, String, Index, UniqueConstraint
from sqlalchemy.sql import func
from geoalchemy2 import Geometry

from app.db.base_class import Base


class Zone(Base):
    """División territorial del Valle de Aburrá.

    Tabla unificada: las comunas de Medellín son polígonos; los municipios del área
    metropolitana son puntos. Por eso geom usa el tipo GEOMETRY genérico (acepta
    Polygon y Point). El cruce espacial (ST_Contains) solo aplica a las comunas.
    """

    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(16), nullable=False, index=True)  # 'comuna' | 'municipio'
    name = Column(String(120), nullable=False)
    slug = Column(String(120), nullable=False)
    number = Column(Integer, nullable=True)  # solo comunas
    center_lat = Column(Float, nullable=True)
    center_lng = Column(Float, nullable=True)
    color = Column(String(16), nullable=True)  # solo municipios
    geom = Column(Geometry(srid=4326, spatial_index=False), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("kind", "slug", name="uq_zones_kind_slug"),)


Index("idx_zones_geom", Zone.geom, postgresql_using="gist")
