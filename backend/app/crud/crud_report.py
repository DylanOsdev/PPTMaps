import json
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from app.models.report import Report, ReportType
from app.schemas.report import ReportCreate, ReportUpdate
from app.db.redis import get_redis
from app.services.alert_broadcaster import publish_alert

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
    
    # Notificar en tiempo real vía WebSocket (Redis Pub/Sub)
    try:
        redis = await get_redis()
        report_data = {
            "type": "new_report",
            "data": {
                "id": db_report.id,
                "report_type": db_report.report_type.value,
                "description": db_report.description,
                "latitude": report_in.latitude,
                "longitude": report_in.longitude,
                "created_at": db_report.created_at.isoformat() if db_report.created_at else None
            }
        }
        await publish_alert(redis, report_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error publishing new_report to Redis: {e}")

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
