import pytest
from sqlalchemy import select, func

from app.models.weather import WeatherSnapshot
from app.services.weather import WeatherClient, WeatherReading, WeatherSyncService

pytestmark = pytest.mark.asyncio


class FakeWeatherClient(WeatherClient):
    """Cliente de prueba: devuelve lecturas fijas, no pega a Open-Meteo."""

    def __init__(self, readings):
        self._readings = readings

    async def fetch_weather(self, points):
        return self._readings


def _reading(name, lat, lng, temp, rain, prob):
    return WeatherReading(
        location_name=name, lat=lat, lng=lng, temperature_c=temp, humidity=80.0,
        rain_mm=rain, precipitation_prob_2h=prob, weather_code=61,
    )


async def test_sync_creates_snapshots(db_session):
    client = FakeWeatherClient([
        _reading("Medellín", 6.2518, -75.5636, 19.0, 0.0, 66),
        _reading("Bello", 6.3373, -75.5611, 18.5, 1.2, 80),
    ])
    n = await WeatherSyncService(client).sync(db_session)
    assert n == 2
    count = (await db_session.execute(select(func.count()).select_from(WeatherSnapshot))).scalar_one()
    assert count == 2


async def test_sync_is_idempotent_by_location(db_session):
    client = FakeWeatherClient([_reading("Medellín", 6.2518, -75.5636, 19.0, 0.0, 66)])
    await WeatherSyncService(client).sync(db_session)
    # Segunda corrida con nuevo valor: actualiza, no duplica.
    client2 = FakeWeatherClient([_reading("Medellín", 6.2518, -75.5636, 22.0, 5.0, 90)])
    await WeatherSyncService(client2).sync(db_session)

    rows = (await db_session.execute(select(WeatherSnapshot))).scalars().all()
    assert len(rows) == 1
    assert rows[0].temperature_c == 22.0
    assert rows[0].precipitation_prob_2h == 90


async def test_snapshot_persists_geom_and_rain(db_session):
    client = FakeWeatherClient([_reading("Itagüí", 6.1719, -75.6111, 17.9, 2.5, 70)])
    await WeatherSyncService(client).sync(db_session)
    row = (await db_session.execute(select(WeatherSnapshot))).scalar_one()
    assert row.rain_mm == 2.5
    assert row.geom is not None
