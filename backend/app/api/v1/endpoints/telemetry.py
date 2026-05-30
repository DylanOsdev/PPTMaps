from typing import List

from fastapi import APIRouter, Depends, status

from app.api.deps import require_api_key
from app.db.redis import get_redis
from app.schemas.telemetry import TelemetryCreate
from app.services.telemetry import enqueue_telemetry

router = APIRouter()


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingesta masiva de telemetría",
    dependencies=[Depends(require_api_key)],
)
async def ingest_telemetry(pings: List[TelemetryCreate], redis=Depends(get_redis)):
    """Encola un lote de pings GPS en Redis y responde 202 (escritura diferida).

    Requiere header X-API-Key (dispositivos GPS = máquinas, no usuarios JWT).
    """
    queued = await enqueue_telemetry(redis, pings)
    return {"queued": queued}
