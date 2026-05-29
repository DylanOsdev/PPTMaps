from fastapi import APIRouter

from app.schemas.report import ReportCreate, ReportRead

router = APIRouter()


@router.post("", response_model=ReportRead, status_code=201)
async def create_report(payload: ReportCreate):
    """Reporte ciudadano (colisión, inundación, obstáculo, hueco)."""
    return ReportRead(
        id=1,
        type=payload.type,
        lat=payload.lat,
        lng=payload.lng,
        status="active",
    )
