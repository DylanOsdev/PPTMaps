from typing import List

from fastapi import APIRouter, Depends, status

from app.db.redis import get_redis
from app.schemas.telemetry import TelemetryPingCreate
from app.services.telemetry import enqueue_telemetry

router = APIRouter()


@router.post("", status_code=status.HTTP_202_ACCEPTED, summary="Ingesta masiva de telemetría")
async def ingest_telemetry(pings: List[TelemetryPingCreate], redis=Depends(get_redis)):
    """Encola un lote de pings GPS en Redis y responde 202 (escritura diferida)."""
    queued = await enqueue_telemetry(redis, pings)
    return {"queued": queued}
