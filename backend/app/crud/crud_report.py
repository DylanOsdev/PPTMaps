from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from app.models.report import Report, ReportStatus, ReportType
from app.schemas.report import ReportCreate, ReportUpdate


async def create_report(db: AsyncSession, report_in: ReportCreate, reporter_id: Optional[UUID] = None) -> Report:
    point = ST_SetSRID(ST_MakePoint(report_in.longitude, report_in.latitude), 4326)
    db_report = Report(
        reporter_id=reporter_id,
        type=report_in.type,
        description=report_in.description,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        location=point,
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report


async def get_reports(
    db: AsyncSession,
    type: Optional[ReportType] = None,
    status: Optional[ReportStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Report]:
    query = select(Report).order_by(desc(Report.created_at))
    if type:
        query = query.where(Report.type == type)
    if status:
        query = query.where(Report.status == status)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_report(db: AsyncSession, report_id: UUID) -> Optional[Report]:
    result = await db.execute(select(Report).where(Report.id == report_id))
    return result.scalar_one_or_none()


async def update_report_status(db: AsyncSession, report_id: UUID, report_in: ReportUpdate) -> Optional[Report]:
    db_report = await get_report(db, report_id)
    if not db_report:
        return None
    db_report.status = report_in.status
    await db.commit()
    await db.refresh(db_report)
    return db_report
