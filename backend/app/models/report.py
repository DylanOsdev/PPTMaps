from datetime import datetime
import enum
from sqlalchemy import Column, DateTime, Enum, Integer, String, Text, Index
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.base_class import Base

class ReportType(str, enum.Enum):
    accident = "accident"
    flood = "flood"
    obstruction = "obstruction"
    other = "other"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_name = Column(String(255), nullable=True)  # Nombre opcional del reportante
    reporter_email = Column(String(255), nullable=True)  # Email opcional del reportante
    report_type = Column(Enum(ReportType, name="report_type"), nullable=False)
    description = Column(Text, nullable=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


Index("idx_reports_geom", Report.geom, postgresql_using="gist")
