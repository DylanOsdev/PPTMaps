from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from app.models.report import Report, ReportType
from app.schemas.report import ReportCreate, ReportUpdate


async def create_report(db: AsyncSession, report_in: ReportCreate, reporter_id: Optional[int] = None) -> Report:
    point = ST_SetSRID(ST_MakePoint(report_in.longitude, report_in.latitude), 4326)
    db_report = Report(
        reporter_id=reporter_id,
        report_type=report_in.report_type,
        description=report_in.description,
        geom=point,
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report


async def get_reports(
    db: AsyncSession,
    report_type: Optional[ReportType] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Report]:
    query = select(Report).order_by(desc(Report.created_at))
    if report_type:
        query = query.where(Report.report_type == report_type)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_report(db: AsyncSession, report_id: int) -> Optional[Report]:
    result = await db.execute(select(Report).where(Report.id == report_id))
    return result.scalar_one_or_none()


async def update_report(db: AsyncSession, report_id: int, report_in: ReportUpdate) -> Optional[Report]:
    db_report = await get_report(db, report_id)
    if not db_report:
        return None
    update_data = report_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_report, field, value)
    await db.commit()
    await db.refresh(db_report)
    return db_report
