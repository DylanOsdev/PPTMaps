"""Telemetría CQRS (opción B): el endpoint encola en Redis (escritura rápida) y un
worker Celery drena el buffer hacia Postgres en lotes (escritura diferida).

Escribe a la tabla `telemetry` (modelo de flota: vehicle_id, heading, location geom).
"""
import json
from datetime import datetime
from typing import List

from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telemetry import Telemetry
from app.schemas.telemetry import TelemetryCreate

BUFFER_KEY = "telemetry:buffer"


async def enqueue_telemetry(redis, pings: List[TelemetryCreate]) -> int:
    """Empuja el lote de pings al buffer Redis. No toca Postgres."""
    if not pings:
        return 0
    payloads = [
        json.dumps(
            {
                "vehicle_id": str(p.vehicle_id),
                "lat": p.lat,
                "lng": p.lng,
                "speed": p.speed,
                "heading": p.heading,
                "timestamp": p.timestamp.isoformat(),
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
            Telemetry(
                vehicle_id=d["vehicle_id"],
                latitude=d["lat"],
                longitude=d["lng"],
                speed=d.get("speed"),
                heading=d.get("heading"),
                location=ST_SetSRID(ST_MakePoint(d["lng"], d["lat"]), 4326),
                timestamp=datetime.fromisoformat(d["timestamp"]),
            )
        )
    await db.commit()
    return len(items)
