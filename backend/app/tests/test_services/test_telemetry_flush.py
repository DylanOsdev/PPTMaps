import json

import pytest
from sqlalchemy import select, func

from app.crud import create_vehicle
from app.models.telemetry import Telemetry
from app.schemas.vehicle import VehicleCreate
from app.services.telemetry import BUFFER_KEY, flush_telemetry

pytestmark = pytest.mark.asyncio


async def _seed_vehicle(db):
    v = await create_vehicle(db, VehicleCreate(plate="TLM001", type="ambulance"))
    return str(v.id)


async def _seed_buffer(redis, vehicle_id, n):
    for i in range(n):
        await redis.lpush(
            BUFFER_KEY,
            json.dumps(
                {
                    "vehicle_id": vehicle_id,
                    "lat": 6.25,
                    "lng": -75.56,
                    "speed": 50.0,
                    "heading": 180.0,
                    "timestamp": "2026-05-29T23:00:00+00:00",
                }
            ),
        )


async def test_flush_drains_buffer_into_postgres(db_session, redis_client):
    vid = await _seed_vehicle(db_session)
    await _seed_buffer(redis_client, vid, 3)

    inserted = await flush_telemetry(db_session, redis_client)
    assert inserted == 3

    count = (await db_session.execute(select(func.count()).select_from(Telemetry))).scalar_one()
    assert count == 3
    assert await redis_client.llen(BUFFER_KEY) == 0


async def test_flush_persists_heading_and_vehicle(db_session, redis_client):
    vid = await _seed_vehicle(db_session)
    await _seed_buffer(redis_client, vid, 1)
    await flush_telemetry(db_session, redis_client)

    row = (await db_session.execute(select(Telemetry))).scalar_one()
    assert str(row.vehicle_id) == vid
    assert row.heading == 180.0
    assert row.speed == 50.0


async def test_flush_empty_buffer_is_noop(db_session, redis_client):
    inserted = await flush_telemetry(db_session, redis_client)
    assert inserted == 0
