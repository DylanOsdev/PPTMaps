import uuid

import pytest
from sqlalchemy import select, func

from app.models.telemetry import Telemetry
from app.services.telemetry import BUFFER_KEY

pytestmark = pytest.mark.asyncio


def _batch(n: int):
    vid = str(uuid.uuid4())
    return [
        {
            "vehicle_id": vid,
            "lat": 6.25 + i * 0.001,
            "lng": -75.56,
            "speed": 40.0 + i,
            "heading": 90.0,
            "timestamp": "2026-05-29T23:00:00+00:00",
        }
        for i in range(n)
    ]


async def test_post_telemetry_returns_202_and_enqueues(client, redis_client, db_session):
    resp = await client.post("/api/v1/telemetry", json=_batch(5))
    assert resp.status_code == 202
    assert resp.json() == {"queued": 5}

    assert await redis_client.llen(BUFFER_KEY) == 5
    count = (await db_session.execute(select(func.count()).select_from(Telemetry))).scalar_one()
    assert count == 0


async def test_post_empty_batch_returns_zero(client, redis_client):
    resp = await client.post("/api/v1/telemetry", json=[])
    assert resp.status_code == 202
    assert resp.json() == {"queued": 0}
    assert await redis_client.llen(BUFFER_KEY) == 0
