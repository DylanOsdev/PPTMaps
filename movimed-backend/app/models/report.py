"""Report model: citizen-submitted incidents (POINT, SRID 4326)."""

import enum

from geoalchemy2 import Geometry
from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ReportType(str, enum.Enum):
    ACCIDENT = "accident"
    FLOOD = "flood"
    OBSTRUCTION = "obstruction"
    OTHER = "other"


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    report_type: Mapped[ReportType] = mapped_column(Enum(ReportType, name="report_type"))
    description: Mapped[str | None] = mapped_column(Text)
    geom: Mapped[object] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=True)
    )
