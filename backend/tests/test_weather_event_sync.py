"""Tests para servicio de sync de eventos climáticos."""
import pytest
from datetime import datetime, timezone

from app.services.weather_event_sync import (
    SeedWeatherClient,
    sync_weather_events,
    WeatherEventData
)
from app.models.weather_event import WeatherEvent


@pytest.mark.asyncio
async def test_seed_client_generates_events():
    """Test: SeedWeatherClient genera eventos sintéticos."""
    client = SeedWeatherClient()
    events = await client.fetch_events()
    
    assert len(events) >= 8
    assert len(events) <= 12
    
    for event in events:
        assert event.event_type in ["rainfall", "lightning", "storm", "hail"]
        assert 1 <= event.severity <= 5
        assert event.intensity > 0
        assert event.lat != 0
        assert event.lng != 0
        assert event.source == "SIATA_SEED"


@pytest.mark.asyncio
async def test_sync_weather_events_inserts_to_db(db_session):
    """Test: sync_weather_events inserta eventos en BD."""
    # Mock client con datos controlados
    class MockClient:
        async def fetch_events(self):
            return [
                WeatherEventData(
                    event_type="rainfall",
                    severity=3,
                    intensity=25.5,
                    lat=6.2442,
                    lng=-75.5812,
                    timestamp=datetime.now(timezone.utc),
                    source="TEST"
                )
            ]
    
    client = MockClient()
    inserted = await sync_weather_events(db_session, client)
    
    assert inserted == 1
    
    # Verificar que se insertó en BD
    result = await db_session.execute(
        "SELECT COUNT(*) FROM weather_events WHERE source = 'TEST'"
    )
    count = result.scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_sync_prevents_duplicates(db_session):
    """Test: sync no inserta duplicados."""
    class MockClient:
        async def fetch_events(self):
            ts = datetime(2026, 6, 11, 20, 0, 0, tzinfo=timezone.utc)
            return [
                WeatherEventData(
                    event_type="rainfall",
                    severity=2,
                    intensity=10.0,
                    lat=6.25,
                    lng=-75.57,
                    timestamp=ts,
                    source="DUP_TEST"
                )
            ]
    
    client = MockClient()
    
    # Primera inserción
    inserted1 = await sync_weather_events(db_session, client)
    assert inserted1 == 1
    
    # Segunda inserción (debe prevenir duplicado)
    inserted2 = await sync_weather_events(db_session, client)
    assert inserted2 == 0  # No debería insertar nada
    
    # Verificar que solo hay 1 registro
    result = await db_session.execute(
        "SELECT COUNT(*) FROM weather_events WHERE source = 'DUP_TEST'"
    )
    count = result.scalar()
    assert count == 1
