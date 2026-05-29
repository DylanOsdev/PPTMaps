from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertUpdate

async def get_alerts(
    db: AsyncSession,
    vehicle_id: Optional[UUID] = None,
    is_resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Alert]:
    query = select(Alert).order_by(desc(Alert.created_at))
    if vehicle_id:
        query = query.where(Alert.vehicle_id == vehicle_id)
    if is_resolved is not None:
        query = query.where(Alert.is_resolved == is_resolved)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

async def create_alert(db: AsyncSession, alert_in: AlertCreate) -> Alert:
    db_alert = Alert(**alert_in.model_dump())
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert

async def resolve_alert(db: AsyncSession, alert_id: UUID, alert_in: AlertUpdate) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    db_alert = result.scalar_one_or_none()
    if not db_alert:
        return None
    for field, value in alert_in.model_dump(exclude_unset=True).items():
        setattr(db_alert, field, value)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert
