from fastapi import APIRouter, Query

router = APIRouter()


@router.get("")
async def get_safe_route(dest: str = Query(..., description="Destino o comuna")):
    """Cálculo de ruta segura (demo — conectar OSRM/PgRouting)."""
    return {
        "destination": dest,
        "coordinates": [
            [6.251, -75.59],
            [6.248, -75.585],
            [6.245, -75.578],
            [6.238, -75.568],
        ],
        "risk_rain_pct": 0,
        "points_avoided": 3,
    }
