from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertUpdate


async def create_alert(db: AsyncSession, alert_in: AlertCreate) -> Alert:
    db_alert = Alert(**alert_in.model_dump())
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert


async def get_alerts(
    db: AsyncSession,
    is_resolved: Optional[bool] = None,
    limit: int = 100,
) -> List[Alert]:
    query = select(Alert).order_by(desc(Alert.created_at))
    if is_resolved is not None:
        query = query.where(Alert.is_resolved == is_resolved)
    result = await db.execute(query.limit(limit))
    return result.scalars().all()


async def update_alert(db: AsyncSession, alert_id: UUID, alert_in: AlertUpdate) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    db_alert = result.scalar_one_or_none()
    if not db_alert:
        return None
    data = alert_in.model_dump(exclude_unset=True)
    if data.get("is_resolved") and db_alert.resolved_at is None:
        db_alert.resolved_at = datetime.now(timezone.utc)
    for field, value in data.items():
        setattr(db_alert, field, value)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert
