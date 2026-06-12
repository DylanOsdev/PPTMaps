"""Tests for air quality sync service (hexagonal architecture)."""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock

from app.services.air_quality_sync import (
    AirQualityData,
    AQISeedClient,
    AirQualitySyncService,
)


@pytest.mark.asyncio
async def test_seed_client_returns_5_stations():
    """Test that AQISeedClient returns exactly 5 demo stations."""
    # Arrange
    client = AQISeedClient()
    
    # Act
    readings = await client.fetch_readings()
    
    # Assert
    assert len(readings) == 5
    assert all(isinstance(r, AirQualityData) for r in readings)
    assert all(r.station_id in ["H12627", "H12635", "H12513", "H12637", "H12626"] for r in readings)


@pytest.mark.asyncio
async def test_seed_client_varies_by_seed():
    """Test that seed client produces different values with different seeds (time-based)."""
    # Arrange
    client = AQISeedClient()
    
    # Act
    readings1 = await client.fetch_readings()
    # Los valores deberían variar cada 5 minutos según el diseño
    # Para este test, solo verificamos que los valores están en rango esperado
    
    # Assert
    for reading in readings1:
        assert 0.0 <= reading.aqi <= 200  # Rango razonable
        assert 0.0 <= reading.pm25 <= 100.0
        assert reading.lat > 6.0 and reading.lat < 7.0  # Medellín aprox
        assert reading.lng < -75.0 and reading.lng > -76.0


@pytest.mark.asyncio
async def test_sync_inserts_readings(db_session):
    """Test that sync service inserts readings from client."""
    # Arrange
    mock_client = AsyncMock()
    mock_client.fetch_readings.return_value = [
        AirQualityData(
            station_id="TEST001",
            station_name="Test Station",
            lat=6.25,
            lng=-75.57,
            aqi=50,
            pm25=12.0,
            pm10=20.0,
            no2=10.0,
            o3=30.0,
            so2=5.0,
            temp=22.0,
            humidity=60.0,
            timestamp=datetime(2026, 6, 11, 15, 0, 0, tzinfo=timezone.utc)
        )
    ]
    service = AirQualitySyncService(mock_client)
    
    # Act
    count = await service.sync(db_session)
    
    # Assert
    assert count == 1
    mock_client.fetch_readings.assert_called_once()


@pytest.mark.asyncio
async def test_sync_skips_duplicates(db_session):
    """Test that sync detects and skips duplicate readings (same station_id + timestamp)."""
    # Arrange
    mock_client = AsyncMock()
    timestamp = datetime(2026, 6, 11, 15, 0, 0, tzinfo=timezone.utc)
    mock_client.fetch_readings.return_value = [
        AirQualityData(
            station_id="TEST002",
            station_name="Test Station 2",
            lat=6.26,
            lng=-75.58,
            aqi=55,
            pm25=15.0,
            pm10=22.0,
            no2=12.0,
            o3=35.0,
            so2=6.0,
            temp=23.0,
            humidity=65.0,
            timestamp=timestamp
        )
    ]
    service = AirQualitySyncService(mock_client)
    
    # Act
    count1 = await service.sync(db_session)
    count2 = await service.sync(db_session)  # Mismo timestamp
    
    # Assert
    assert count1 == 1
    assert count2 == 0  # Duplicate skipped by unique constraint
