import pytest
from sqlalchemy import text

pytestmark = pytest.mark.asyncio


async def _seed(db, name, lng, lat, temp, rain, prob):
    await db.execute(
        text(
            "INSERT INTO weather_snapshots "
            "(location_name, geom, temperature_c, humidity, rain_mm, precipitation_prob_2h, weather_code, recorded_at) "
            "VALUES (:n, ST_SetSRID(ST_MakePoint(:lng,:lat),4326), :t, 80, :r, :p, 61, now())"
        ),
        {"n": name, "lng": lng, "lat": lat, "t": temp, "r": rain, "p": prob},
    )
    await db.commit()


async def test_public_weather_lists_snapshots(client, db_session):
    await _seed(db_session, "Medellín", -75.5636, 6.2518, 19.0, 0.0, 30)
    await _seed(db_session, "Bello", -75.5611, 6.3373, 18.5, 1.2, 70)

    resp = await client.get("/api/v1/public/weather")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    item = next(d for d in data if d["location_name"] == "Medellín")
    assert {"location_name", "lat", "lng", "temperature_c", "rain_mm", "precipitation_prob_2h", "weather_code"} <= set(item)
    assert item["lat"] == pytest.approx(6.2518, abs=1e-3)


async def test_public_rain_risk_filters_by_threshold(client, db_session):
    await _seed(db_session, "Medellín", -75.5636, 6.2518, 19.0, 0.0, 30)   # bajo umbral
    await _seed(db_session, "Bello", -75.5611, 6.3373, 18.5, 1.2, 70)      # sobre umbral

    resp = await client.get("/api/v1/public/rain-risk")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["location_name"] == "Bello"
    assert data[0]["precipitation_prob_2h"] == 70
