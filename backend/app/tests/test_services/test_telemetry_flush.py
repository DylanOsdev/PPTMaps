import json

import pytest
from sqlalchemy import select, func

from app.models.telemetry import TelemetryPing
from app.services.telemetry import BUFFER_KEY, flush_telemetry

pytestmark = pytest.mark.asyncio


async def _seed_buffer(redis, n):
    for i in range(n):
        await redis.lpush(
            BUFFER_KEY,
            json.dumps(
                {
                    "device_id": f"dev-{i}",
                    "lat": 6.25,
                    "lng": -75.56,
                    "speed_kmh": 50.0,
                    "recorded_at": "2026-05-29T23:00:00+00:00",
                }
            ),
        )


async def test_flush_drains_buffer_into_postgres(db_session, redis_client):
    await _seed_buffer(redis_client, 3)

    inserted = await flush_telemetry(db_session, redis_client)
    assert inserted == 3

    count = (await db_session.execute(select(func.count()).select_from(TelemetryPing))).scalar_one()
    assert count == 3
    # El buffer queda vacío tras drenarlo.
    assert await redis_client.llen(BUFFER_KEY) == 0


async def test_flush_empty_buffer_is_noop(db_session, redis_client):
    inserted = await flush_telemetry(db_session, redis_client)
    assert inserted == 0
    count = (await db_session.execute(select(func.count()).select_from(TelemetryPing))).scalar_one()
    assert count == 0
