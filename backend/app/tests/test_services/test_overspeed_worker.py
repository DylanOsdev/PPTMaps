from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.crud import create_vehicle, crud_alert
from app.models.alert import Alert
from app.models.telemetry import Telemetry
from app.schemas.vehicle import VehicleCreate
from app.schemas.alert import AlertCreate
from app.tasks.worker import detect_overspeed, OVERSPEED_THRESHOLD_KMH

pytestmark = pytest.mark.asyncio


async def _add_ping(db, vehicle_id, speed):
    from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

    db.add(
        Telemetry(
            vehicle_id=vehicle_id,
            latitude=6.25,
            longitude=-75.56,
            speed=speed,
            heading=90.0,
            location=ST_SetSRID(ST_MakePoint(-75.56, 6.25), 4326),
            timestamp=datetime.now(timezone.utc),
        )
    )
    await db.commit()


async def test_detect_overspeed_creates_alert(db_session):
    v = await create_vehicle(db_session, VehicleCreate(plate="OS001", type="patrol"))
    await _add_ping(db_session, v.id, OVERSPEED_THRESHOLD_KMH + 20)

    created = await detect_overspeed(db_session)
    assert len(created) == 1

    alerts = (await db_session.execute(select(Alert).where(Alert.type == "OVERSPEED"))).scalars().all()
    assert len(alerts) == 1
    assert alerts[0].vehicle_id == v.id


async def test_detect_overspeed_ignores_within_limit(db_session):
    v = await create_vehicle(db_session, VehicleCreate(plate="OS002", type="patrol"))
    await _add_ping(db_session, v.id, OVERSPEED_THRESHOLD_KMH - 10)

    created = await detect_overspeed(db_session)
    assert len(created) == 0


async def test_detect_overspeed_no_duplicate_active_alert(db_session):
    v = await create_vehicle(db_session, VehicleCreate(plate="OS003", type="patrol"))
    await crud_alert.create_alert(
        db_session, AlertCreate(type="OVERSPEED", message="ya activa", vehicle_id=v.id)
    )
    await _add_ping(db_session, v.id, OVERSPEED_THRESHOLD_KMH + 5)

    created = await detect_overspeed(db_session)
    assert len(created) == 0
