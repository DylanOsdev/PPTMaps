from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.routing import compute_route

router = APIRouter()

# Centro de Medellín (Parque Berrío) como origen por defecto.
DEFAULT_ORIGIN = (6.2518, -75.5636)


def _parse_latlng(value: str) -> tuple[float, float]:
    try:
        lat, lng = (float(p) for p in value.split(","))
        return lat, lng
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Coordenada inválida; usar 'lat,lng'")


@router.get("", summary="Ruta resiliente que esquiva zonas de riesgo activas")
async def get_route(
    destination: str = Query(..., description="Destino como 'lat,lng'"),
    origin: str | None = Query(None, description="Origen como 'lat,lng' (default centro Medellín)"),
    db: AsyncSession = Depends(get_db),
):
    dest = _parse_latlng(destination)
    orig = _parse_latlng(origin) if origin else DEFAULT_ORIGIN
    return await compute_route(db, orig, dest)
