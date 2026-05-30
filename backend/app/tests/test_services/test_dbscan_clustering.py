import pytest
from sqlalchemy import select, func, text

from app.crud.crud_report import create_report
from app.schemas.report import ReportCreate
from app.models.report import ReportType
from app.models.accident_zone import AccidentZone
from app.ml.dbscan_clustering import cluster_accident_hotspots

pytestmark = pytest.mark.asyncio


async def _accident(db, lat, lng):
    await create_report(
        db, ReportCreate(report_type=ReportType.accident, description="x", latitude=lat, longitude=lng)
    )


async def test_clusters_dense_accidents_into_zone(db_session):
    # 4 accidentes muy juntos (~mismo punto) → 1 cluster.
    for d in range(4):
        await _accident(db_session, 6.2500 + d * 0.0002, -75.5630 + d * 0.0002)

    created = await cluster_accident_hotspots(db_session, eps_meters=200, min_samples=3)
    assert created == 1

    zones = (await db_session.execute(select(AccidentZone))).scalars().all()
    assert len(zones) == 1
    assert zones[0].incident_count == 4


async def test_sparse_accidents_form_no_zone(db_session):
    # 3 accidentes lejos entre sí → ningún cluster con min_samples=3.
    await _accident(db_session, 6.20, -75.58)
    await _accident(db_session, 6.30, -75.50)
    await _accident(db_session, 6.25, -75.62)

    created = await cluster_accident_hotspots(db_session, eps_meters=200, min_samples=3)
    assert created == 0
    count = (await db_session.execute(select(func.count()).select_from(AccidentZone))).scalar_one()
    assert count == 0


async def test_rerun_replaces_generated_zones(db_session):
    for d in range(3):
        await _accident(db_session, 6.2500 + d * 0.0002, -75.5630)
    await cluster_accident_hotspots(db_session, eps_meters=200, min_samples=3)
    # Segunda corrida no debe duplicar zonas generadas.
    await cluster_accident_hotspots(db_session, eps_meters=200, min_samples=3)
    count = (await db_session.execute(select(func.count()).select_from(AccidentZone))).scalar_one()
    assert count == 1
