from fastapi import APIRouter

router = APIRouter()


@router.get("/predictive-map")
async def predictive_map():
    """Mapa predictivo de congestión / telemetría (demo)."""
    return {
        "features": [
            {"lat": 6.255, "lng": -75.595, "weight": 0.8},
            {"lat": 6.24, "lng": -75.588, "weight": 0.6},
        ],
        "updated_at": "2026-05-29T00:00:00Z",
    }
