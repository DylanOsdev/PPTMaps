"""Tests for AirQualityReading model."""
import pytest
from datetime import datetime, timezone
from geoalchemy2.shape import to_shape
from shapely.geometry import Point

from app.models.air_quality_reading import AirQualityReading


@pytest.mark.asyncio
async def test_air_quality_reading_creation(db_session):
    """Test creating an AirQualityReading with all fields."""
    # Arrange
    reading = AirQualityReading(
        station_id="H12627",
        station_name="Belén",
        geom="SRID=4326;POINT(-75.5877 6.2322)",
        aqi=63,
        pm25=18.5,
        pm10=25.0,
        no2=12.3,
        o3=45.0,
        so2=5.0,
        temp=22.5,
        humidity=65.0,
        timestamp=datetime(2026, 6, 11, 13, 0, 0, tzinfo=timezone.utc)
    )
    
    # Act
    db_session.add(reading)
    await db_session.commit()
    await db_session.refresh(reading)
    
    # Assert
    assert reading.id is not None
    assert reading.station_id == "H12627"
    assert reading.station_name == "Belén"
    assert reading.aqi == 63
    assert reading.pm25 == 18.5
    assert reading.created_at is not None


@pytest.mark.asyncio
async def test_air_quality_reading_geometry_stored_correctly(db_session):
    """Test that PostGIS POINT geometry is stored and retrieved correctly."""
    # Arrange
    reading = AirQualityReading(
        station_id="H12635",
        station_name="El Poblado",
        geom="SRID=4326;POINT(-75.5700 6.2100)",
        aqi=55,
        pm25=15.0,
        pm10=20.0,
        no2=10.0,
        o3=40.0,
        so2=4.0,
        temp=23.0,
        humidity=60.0,
        timestamp=datetime(2026, 6, 11, 14, 0, 0, tzinfo=timezone.utc)
    )
    
    # Act
    db_session.add(reading)
    await db_session.commit()
    await db_session.refresh(reading)
    
    # Assert
    point = to_shape(reading.geom)
    assert isinstance(point, Point)
    assert point.x == pytest.approx(-75.5700, abs=0.0001)
    assert point.y == pytest.approx(6.2100, abs=0.0001)
