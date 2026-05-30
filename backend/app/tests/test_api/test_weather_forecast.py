import pytest

from app.main import app
from app.api.v1.endpoints.public import get_forecast_client
from app.services.weather import ForecastClient

pytestmark = pytest.mark.asyncio


class FakeForecastClient(ForecastClient):
    async def fetch_forecast(self, lat, lng):
        return {
            "current": {"temperature_2m": 21.0, "weather_code": 3},
            "hourly": {"time": [], "temperature_2m": [], "precipitation_probability": [], "weather_code": []},
            "daily": {"time": [], "temperature_2m_max": [], "temperature_2m_min": [], "precipitation_sum": [], "weather_code": []},
        }


async def test_weather_forecast_returns_open_meteo_shape(client):
    app.dependency_overrides[get_forecast_client] = lambda: FakeForecastClient()
    try:
        resp = await client.get("/api/v1/public/weather/forecast")
        assert resp.status_code == 200
        data = resp.json()
        assert {"current", "hourly", "daily"} <= set(data)
        assert data["current"]["temperature_2m"] == 21.0
    finally:
        app.dependency_overrides.pop(get_forecast_client, None)
