"""Telemetría CQRS: el endpoint encola en Redis (escritura rápida) y un worker
Celery drena el buffer hacia Postgres en lotes (escritura diferida)."""
import json
from datetime import datetime
from typing import List

from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telemetry import TelemetryPing
from app.schemas.telemetry import TelemetryPingCreate

BUFFER_KEY = "telemetry:buffer"


async def enqueue_telemetry(redis, pings: List[TelemetryPingCreate]) -> int:
    """Empuja el lote de pings al buffer Redis. No toca Postgres."""
    if not pings:
        return 0
    payloads = [
        json.dumps(
            {
                "device_id": p.device_id,
                "lat": p.lat,
                "lng": p.lng,
                "speed_kmh": p.speed_kmh,
                "recorded_at": p.recorded_at.isoformat(),
            }
        )
        for p in pings
    ]
    await redis.lpush(BUFFER_KEY, *payloads)
    return len(payloads)


async def flush_telemetry(db: AsyncSession, redis) -> int:
    """Drena el buffer Redis e inserta los pings en Postgres en bloque."""
    # Lee y borra el buffer de forma atómica para no perder ni duplicar pings.
    async with redis.pipeline(transaction=True) as pipe:
        pipe.lrange(BUFFER_KEY, 0, -1)
        pipe.delete(BUFFER_KEY)
        items, _ = await pipe.execute()

    if not items:
        return 0

    for raw in items:
        d = json.loads(raw)
        db.add(
            TelemetryPing(
                device_id=d["device_id"],
                geom=ST_SetSRID(ST_MakePoint(d["lng"], d["lat"]), 4326),
                speed_kmh=d.get("speed_kmh"),
                recorded_at=datetime.fromisoformat(d["recorded_at"]),
            )
        )
    await db.commit()
    return len(items)
