"""FloodHazard model: flood-prone road dips ("deprimidos viales", POLYGON 4326)."""

import enum

from geoalchemy2 import Geometry
from sqlalchemy import Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FloodStatus(str, enum.Enum):
    DRY = "dry"
    WATCH = "watch"
    FLOODED = "flooded"


class FloodHazard(Base, TimestampMixin):
    __tablename__ = "flood_hazards"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    siata_station_id: Mapped[str | None] = mapped_column(String(64), index=True)
    status: Mapped[FloodStatus] = mapped_column(
        Enum(FloodStatus, name="flood_status"), default=FloodStatus.DRY
    )
    water_level_m: Mapped[float | None] = mapped_column(Float)
    geom: Mapped[object] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True)
    )
