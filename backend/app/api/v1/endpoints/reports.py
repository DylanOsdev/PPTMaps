from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.crud_report import create_report, get_reports, get_report, update_report
from app.db.database import get_db
from app.models.report import ReportType
from app.schemas.report import Report, ReportCreate, ReportUpdate

router = APIRouter()


@router.get("/", response_model=List[Report], summary="Listar reportes ciudadanos (público)")
async def list_reports(
    report_type: Optional[ReportType] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Lista todos los reportes ciudadanos. Endpoint público."""
    return await get_reports(db, report_type=report_type, skip=skip, limit=limit)


@router.post("/", response_model=Report, status_code=201, summary="Crear reporte de incidente (público)")
async def create_report_endpoint(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
):
    """Crea un reporte ciudadano anónimo. No requiere autenticación."""
    return await create_report(db, report_in=report_in, reporter_id=None)


@router.get("/{report_id}", response_model=Report, summary="Obtener un reporte (público)")
async def get_report_endpoint(
    report_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Obtiene un reporte específico. Endpoint público."""
    report = await get_report(db, report_id=report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report


@router.put("/{report_id}", response_model=Report, summary="Actualizar un reporte (público)")
async def update_report_endpoint(
    report_id: int,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un reporte existente. Endpoint público."""
    report = await update_report(db, report_id=report_id, report_in=report_in)
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report
