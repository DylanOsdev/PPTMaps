"""Clima y lluvia del Valle de Aburrá (arquitectura hexagonal, fuente Open-Meteo).

El servicio depende de la interfaz WeatherClient, no de una fuente concreta. El
adaptador OpenMeteoClient consulta varios puntos en UNA sola llamada (multipunto) y
WeatherSyncService persiste/actualiza el último snapshot por ubicación.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import httpx
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.weather import WeatherSnapshot

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Puntos del Valle de Aburrá (name, lat, lng).
VALLE_ABURRA_POINTS: List[Tuple[str, float, float]] = [
    ("Medellín", 6.2518, -75.5636),
    ("Bello", 6.3373, -75.5611),
    ("Itagüí", 6.1719, -75.6111),
    ("Envigado", 6.1699, -75.5836),
    ("Sabaneta", 6.1518, -75.6166),
]


@dataclass
class WeatherReading:
    location_name: str
    lat: float
    lng: float
    temperature_c: Optional[float]
    humidity: Optional[float]
    rain_mm: Optional[float]
    precipitation_prob_2h: Optional[int]
    weather_code: Optional[int]


class WeatherClient(ABC):
    """Puerto: fuente de lecturas de clima por punto."""

    @abstractmethod
    async def fetch_weather(self, points: List[Tuple[str, float, float]]) -> List[WeatherReading]:
        ...


class OpenMeteoClient(WeatherClient):
    """Adaptador HTTP a Open-Meteo (multipunto, sin API key)."""

    async def fetch_weather(self, points: List[Tuple[str, float, float]]) -> List[WeatherReading]:
        if not points:
            return []
        lats = ",".join(str(p[1]) for p in points)
        lngs = ",".join(str(p[2]) for p in points)
        params = {
            "latitude": lats,
            "longitude": lngs,
            "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code",
            "hourly": "precipitation_probability",
            "forecast_hours": 2,
            "timezone": "America/Bogota",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        # Con multipunto Open-Meteo devuelve una lista; con un punto, un objeto.
        blocks = data if isinstance(data, list) else [data]
        readings: List[WeatherReading] = []
        for (name, lat, lng), block in zip(points, blocks):
            cur = block.get("current", {})
            probs = block.get("hourly", {}).get("precipitation_probability", [])
            readings.append(
                WeatherReading(
                    location_name=name,
                    lat=lat,
                    lng=lng,
                    temperature_c=cur.get("temperature_2m"),
                    humidity=cur.get("relative_humidity_2m"),
                    rain_mm=cur.get("rain"),
                    precipitation_prob_2h=max(probs) if probs else None,
                    weather_code=cur.get("weather_code"),
                )
            )
        return readings


class WeatherSyncService:
    def __init__(self, client: WeatherClient):
        self._client = client

    async def sync(self, db: AsyncSession, points=VALLE_ABURRA_POINTS) -> int:
        readings = await self._client.fetch_weather(points)
        for r in readings:
            snap = (
                await db.execute(
                    select(WeatherSnapshot).where(WeatherSnapshot.location_name == r.location_name)
                )
            ).scalar_one_or_none()
            if snap is None:
                snap = WeatherSnapshot(
                    location_name=r.location_name,
                    geom=ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326),
                )
                db.add(snap)
            snap.temperature_c = r.temperature_c
            snap.humidity = r.humidity
            snap.rain_mm = r.rain_mm
            snap.precipitation_prob_2h = r.precipitation_prob_2h
            snap.weather_code = r.weather_code
            snap.recorded_at = datetime.now(timezone.utc)
        await db.commit()
        return len(readings)
