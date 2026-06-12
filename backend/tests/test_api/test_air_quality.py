"""Tests para endpoints públicos de Air Quality."""
import pytest
from httpx import AsyncClient
from datetime import datetime, timezone

from app.main import app


@pytest.mark.asyncio
async def test_get_current_returns_latest_readings(db_session):
    """GET /current retorna las últimas lecturas (una por estación)."""
    # Seed: 2 estaciones con múltiples timestamps
    from app.models.air_quality_reading import AirQualityReading
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    
    station_a = AirQualityReading(
        station_id="test-a",
        station_name="Test A",
        geom=from_shape(Point(-75.56, 6.25), srid=4326),
        aqi=42,
        timestamp=datetime(2026, 6, 11, 14, 0, tzinfo=timezone.utc)
    )
    station_a_old = AirQualityReading(
        station_id="test-a",
        station_name="Test A",
        geom=from_shape(Point(-75.56, 6.25), srid=4326),
        aqi=30,
        timestamp=datetime(2026, 6, 11, 12, 0, tzinfo=timezone.utc)
    )
    station_b = AirQualityReading(
        station_id="test-b",
        station_name="Test B",
        geom=from_shape(Point(-75.57, 6.26), srid=4326),
        aqi=65,
        timestamp=datetime(2026, 6, 11, 14, 0, tzinfo=timezone.utc)
    )
    
    db_session.add_all([station_a, station_a_old, station_b])
    await db_session.commit()
    
    # Request
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/public/air-quality/current")
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 2  # Solo las más recientes
    assert data[0]["station_id"] == "test-a"
    assert data[0]["aqi"] == 42  # No 30
    assert data[1]["station_id"] == "test-b"
    assert data[1]["aqi"] == 65


@pytest.mark.asyncio
async def test_get_by_station_filters_correctly(db_session):
    """GET /station/{id} retorna solo lecturas de esa estación."""
    from app.models.air_quality_reading import AirQualityReading
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    target_station = AirQualityReading(
        station_id="target",
        station_name="Target",
        geom=from_shape(Point(-75.56, 6.25), srid=4326),
        aqi=50,
        timestamp=now - timedelta(hours=1)
    )
    other_station = AirQualityReading(
        station_id="other",
        station_name="Other",
        geom=from_shape(Point(-75.57, 6.26), srid=4326),
        aqi=80,
        timestamp=now - timedelta(hours=1)
    )
    
    db_session.add_all([target_station, other_station])
    await db_session.commit()
    
    # Request
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/public/air-quality/station/target")
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["station_id"] == "target"
    assert data[0]["aqi"] == 50


@pytest.mark.asyncio
async def test_map_returns_valid_geojson(db_session):
    """GET /map retorna GeoJSON válido con Features."""
    from app.models.air_quality_reading import AirQualityReading
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    
    reading = AirQualityReading(
        station_id="map-test",
        station_name="Map Test",
        geom=from_shape(Point(-75.56, 6.25), srid=4326),
        aqi=42,
        pm25=12.5,
        timestamp=datetime.now(timezone.utc)
    )
    
    db_session.add(reading)
    await db_session.commit()
    
    # Request
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/public/air-quality/map")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1
    
    feature = data["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "Point"
    assert feature["properties"]["station_id"] == "map-test"
    assert feature["properties"]["aqi"] == 42


@pytest.mark.asyncio
async def test_by_comuna_aggregates_aqi(db_session):
    """GET /by-comuna retorna AQI promedio por comuna."""
    from app.models.air_quality_reading import AirQualityReading
    from app.models.zone import Zone
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point, Polygon
    
    # Seed: 1 comuna
    comuna = Zone(
        name="Laureles",
        kind="comuna",
        center_lat=6.25,
        center_lng=-75.56,
        geom=from_shape(Polygon([
            (-75.57, 6.24), (-75.55, 6.24), (-75.55, 6.26), (-75.57, 6.26), (-75.57, 6.24)
        ]), srid=4326)
    )
    db_session.add(comuna)
    await db_session.flush()
    
    # Seed: 2 estaciones con AQI
    reading1 = AirQualityReading(
        station_id="st1",
        station_name="Station 1",
        geom=from_shape(Point(-75.56, 6.25), srid=4326),
        aqi=40,
        timestamp=datetime.now(timezone.utc)
    )
    reading2 = AirQualityReading(
        station_id="st2",
        station_name="Station 2",
        geom=from_shape(Point(-75.56, 6.25), srid=4326),
        aqi=60,
        timestamp=datetime.now(timezone.utc)
    )
    
    db_session.add_all([reading1, reading2])
    await db_session.commit()
    
    # Request
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/public/air-quality/by-comuna")
    
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) >= 1
    laureles = next((c for c in data if c["comuna_name"] == "Laureles"), None)
    assert laureles is not None
    assert laureles["aqi_avg"] == 50.0  # (40 + 60) / 2
    assert laureles["station_count"] == 2
