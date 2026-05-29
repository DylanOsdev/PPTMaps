from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user
from app.crud.crud_report import create_report, get_reports, get_report, update_report_status
from app.db.database import get_db
from app.models.user import User
from app.models.report import ReportType, ReportStatus
from app.schemas.report import Report, ReportCreate, ReportUpdate

router = APIRouter()


@router.get("/", response_model=List[Report], summary="Listar reportes ciudadanos")
async def list_reports(
    type: Optional[ReportType] = None,
    status: Optional[ReportStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return await get_reports(db, type=type, status=status, skip=skip, limit=limit)


@router.post("/", response_model=Report, status_code=201, summary="Crear reporte de incidente")
async def create_report_endpoint(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return await create_report(db, report_in=report_in, reporter_id=current_user.id)


@router.get("/{report_id}", response_model=Report, summary="Obtener un reporte")
async def get_report_endpoint(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    report = await get_report(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report


@router.put("/{report_id}/status", response_model=Report, summary="Actualizar estado de un reporte")
async def update_report_status_endpoint(
    report_id: UUID,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    report = await update_report_status(db, report_id=report_id, report_in=report_in)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report
