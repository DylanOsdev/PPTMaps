import pytest
from sqlalchemy import select, func

from app.models.flood_hazard import FloodHazard, FloodStatus
from app.services.siata_sync import (
    GaugeReading,
    SiataGaugeClient,
    SiataSyncService,
    SiataSeedClient,
)

pytestmark = pytest.mark.asyncio


class _FakeClient(SiataGaugeClient):
    def __init__(self, readings):
        self._readings = readings

    async def fetch_levels(self):
        return self._readings


async def _count(db):
    result = await db.execute(select(func.count()).select_from(FloodHazard))
    return result.scalar_one()


async def test_sync_creates_hazards_from_seed(db_session):
    service = SiataSyncService(SiataSeedClient())
    processed = await service.sync(db_session)
    assert processed > 0
    assert await _count(db_session) == processed


async def test_level_maps_to_status(db_session):
    readings = [
        GaugeReading(station_id="S-DRY", name="seca", lat=6.25, lng=-75.56, water_level_m=0.2),
        GaugeReading(station_id="S-WATCH", name="alerta", lat=6.26, lng=-75.57, water_level_m=1.2),
        GaugeReading(station_id="S-FLOOD", name="desbordada", lat=6.27, lng=-75.58, water_level_m=3.0),
    ]
    service = SiataSyncService(_FakeClient(readings))
    await service.sync(db_session)

    rows = {
        r.siata_station_id: r
        for r in (await db_session.execute(select(FloodHazard))).scalars().all()
    }
    assert rows["S-DRY"].status == FloodStatus.dry
    assert rows["S-WATCH"].status == FloodStatus.watch
    assert rows["S-FLOOD"].status == FloodStatus.flooded


async def test_sync_is_idempotent_and_updates(db_session):
    first = [GaugeReading(station_id="S-1", name="est", lat=6.25, lng=-75.56, water_level_m=0.1)]
    service = SiataSyncService(_FakeClient(first))
    await service.sync(db_session)
    assert await _count(db_session) == 1

    # Misma estación, nivel mayor: no duplica, actualiza status y nivel.
    service2 = SiataSyncService(
        _FakeClient([GaugeReading(station_id="S-1", name="est", lat=6.25, lng=-75.56, water_level_m=3.0)])
    )
    await service2.sync(db_session)
    assert await _count(db_session) == 1

    row = (await db_session.execute(select(FloodHazard))).scalar_one()
    assert row.status == FloodStatus.flooded
    assert row.water_level_m == 3.0


async def test_hazard_geom_is_polygon_buffer(db_session):
    service = SiataSyncService(
        _FakeClient([GaugeReading(station_id="S-G", name="g", lat=6.25, lng=-75.56, water_level_m=0.5)])
    )
    await service.sync(db_session)
    # ST_GeometryType debe ser un polígono (buffer alrededor del punto).
    result = await db_session.execute(
        select(func.ST_GeometryType(FloodHazard.geom)).where(FloodHazard.siata_station_id == "S-G")
    )
    assert result.scalar_one() == "ST_Polygon"
