import uuid

import pytest
from sqlalchemy import text

from app.crud import create_vehicle, crud_alert
from app.crud.crud_report import create_report
from app.schemas.vehicle import VehicleCreate
from app.schemas.alert import AlertCreate
from app.schemas.report import ReportCreate
from app.models.report import ReportType
from app.services.telemetry import flush_telemetry, BUFFER_KEY

pytestmark = pytest.mark.asyncio


async def _seed_telemetry(db, redis):
    v = await create_vehicle(db, VehicleCreate(plate="PUB001", type="ambulance"))
    import json

    await redis.lpush(
        BUFFER_KEY,
        json.dumps(
            {
                "vehicle_id": str(v.id),
                "lat": 6.25,
                "lng": -75.56,
                "speed": 40.0,
                "heading": 90.0,
                "timestamp": "2026-05-29T23:00:00+00:00",
            }
        ),
    )
    await flush_telemetry(db, redis)


async def test_public_telemetry_latest(client, db_session, redis_client):
    await _seed_telemetry(db_session, redis_client)
    resp = await client.get("/api/v1/public/telemetry/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert {"id", "vehicle_id", "lat", "lng", "speed", "heading", "timestamp"} <= set(data[0])


async def test_public_alerts(client, db_session):
    await crud_alert.create_alert(db_session, AlertCreate(type="traffic", message="Congestión"))
    resp = await client.get("/api/v1/public/alerts?is_resolved=false&limit=20")
    assert resp.status_code == 200
    data = resp.json()
    assert any(a["message"] == "Congestión" for a in data)


async def test_public_accidents_geojson(client, db_session):
    await create_report(
        db_session, ReportCreate(report_type=ReportType.accident, description="Choque", latitude=6.25, longitude=-75.56)
    )
    resp = await client.get("/api/v1/public/accidents/geojson")
    assert resp.status_code == 200
    fc = resp.json()
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 1
    assert fc["features"][0]["geometry"]["type"] == "Point"


async def test_public_fatalities(client, db_session):
    await create_report(
        db_session, ReportCreate(report_type=ReportType.accident, description="Fatal", latitude=6.2, longitude=-75.5)
    )
    resp = await client.get("/api/v1/public/fatalities")
    assert resp.status_code == 200
    fc = resp.json()
    assert fc["type"] == "FeatureCollection"


async def test_public_flood_zones(client, db_session):
    await db_session.execute(
        text(
            "INSERT INTO flood_hazards (name, siata_station_id, status, water_level_m, geom) "
            "VALUES ('Q. Test', 'T001', 'watch', 1.5, "
            "ST_SetSRID(ST_GeomFromText('POLYGON((-75.6 6.2,-75.59 6.21,-75.58 6.2,-75.59 6.19,-75.6 6.2))'),4326))"
        )
    )
    await db_session.commit()
    resp = await client.get("/api/v1/public/flood-zones")
    assert resp.status_code == 200
    zones = resp.json()
    # Contrato frontend (updateFloodZones): array plano con geom como geometría GeoJSON.
    assert isinstance(zones, list)
    assert len(zones) == 1
    assert zones[0]["status"] == "watch"
    assert zones[0]["geom"]["type"] == "Polygon"
    assert zones[0]["name"] == "Q. Test"
