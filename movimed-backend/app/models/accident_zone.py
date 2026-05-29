"""AccidentZone model: accident-prone areas (MULTIPOLYGON, SRID 4326).

Polygons are produced by the DBSCAN clustering job (Part 5).
"""

from geoalchemy2 import Geometry
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AccidentZone(Base, TimestampMixin):
    __tablename__ = "accident_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255))
    severity: Mapped[int] = mapped_column(Integer, default=1)
    incident_count: Mapped[int] = mapped_column(Integer, default=0)
    geom: Mapped[object] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True)
    )
