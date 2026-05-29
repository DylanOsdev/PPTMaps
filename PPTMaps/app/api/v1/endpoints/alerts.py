from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.crud import get_alerts, create_alert, resolve_alert
from app.db.database import get_db
from app.models.user import User
from app.schemas.alert import Alert, AlertCreate, AlertUpdate

router = APIRouter()

@router.get("/", response_model=List[Alert], summary="Listar alertas")
async def list_alerts(
    vehicle_id: Optional[UUID] = None,
    is_resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await get_alerts(db, vehicle_id=vehicle_id, is_resolved=is_resolved, skip=skip, limit=limit)

@router.post("/", response_model=Alert, status_code=201, summary="Crear alerta manual")
async def create_alert_endpoint(
    alert_in: AlertCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await create_alert(db, alert_in=alert_in)

@router.put("/{alert_id}/resolve", response_model=Alert, summary="Resolver una alerta")
async def resolve_alert_endpoint(
    alert_id: UUID,
    alert_in: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    alert = await resolve_alert(db, alert_id=alert_id, alert_in=alert_in)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return alert
