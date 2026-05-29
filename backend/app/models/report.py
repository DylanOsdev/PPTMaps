import uuid
import enum
from sqlalchemy import Column, String, Enum, DateTime, ForeignKey, Index, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base import Base


class ReportType(str, enum.Enum):
    ACCIDENT = "ACCIDENT"
    FLOOD = "FLOOD"
    OBSTRUCTION = "OBSTRUCTION"
    OTHER = "OTHER"


class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    type = Column(Enum(ReportType), nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING, nullable=False)
    description = Column(String, nullable=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # PostGIS POINT (WGS84 / SRID 4326). spatial_index=False: the GIST index is
    # declared explicitly below to avoid GeoAlchemy2 creating a duplicate.
    location = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reporter = relationship("User")


Index("idx_reports_location", Report.location, postgresql_using="gist")
