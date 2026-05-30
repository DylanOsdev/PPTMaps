import pytest
from sqlalchemy import text

from app.services.zones_seed import import_zones
from app.crud.crud_report import create_report
from app.schemas.report import ReportCreate
from app.models.report import ReportType

pytestmark = pytest.mark.asyncio

# Comuna cuadrada que cubre (-75.58..-75.54, 6.28..6.32).
COMUNA = {
    "comunas": [{
        "id": 1, "number": 1, "name": "Popular", "slug": "popular", "type": "comuna",
        "center": [6.30, -75.56],
        "geojson": {"type": "Feature", "properties": {"name": "Popular"},
                    "geometry": {"type": "Polygon", "coordinates": [[[-75.58, 6.28], [-75.54, 6.28], [-75.54, 6.32], [-75.58, 6.32], [-75.58, 6.28]]]}},
    }],
    "municipios": [],
}


async def test_accidents_by_comuna_counts_only_inside(client, db_session):
    await import_zones(db_session, COMUNA)
    # 2 accidentes DENTRO del polígono, 1 FUERA.
    await create_report(db_session, ReportCreate(report_type=ReportType.accident, description="in1", latitude=6.30, longitude=-75.56))
    await create_report(db_session, ReportCreate(report_type=ReportType.accident, description="in2", latitude=6.29, longitude=-75.55))
    await create_report(db_session, ReportCreate(report_type=ReportType.accident, description="out", latitude=6.40, longitude=-75.40))

    resp = await client.get("/api/v1/public/comunas/stats")
    assert resp.status_code == 200
    data = resp.json()
    popular = next(z for z in data if z["slug"] == "popular")
    assert popular["accident_count"] == 2
    assert popular["name"] == "Popular"
    assert popular["number"] == 1


async def test_stats_empty_when_no_accidents(client, db_session):
    await import_zones(db_session, COMUNA)
    resp = await client.get("/api/v1/public/comunas/stats")
    assert resp.status_code == 200
    popular = next(z for z in resp.json() if z["slug"] == "popular")
    assert popular["accident_count"] == 0
