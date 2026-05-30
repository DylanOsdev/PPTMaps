"""Ingesta SIATA → flood_hazards (arquitectura hexagonal).

El servicio depende de la interfaz SiataGaugeClient, no de una fuente concreta.
Hoy se usa un adaptador seed con estaciones reales del geoportal SIATA; cuando
exista un endpoint real, basta implementar otro SiataGaugeClient (p.ej. HTTP).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_flood_hazard
from app.models.flood_hazard import FloodStatus

# Umbrales de nivel (m) → estado. Aproximación para la demo.
WATCH_LEVEL_M = 1.0
FLOOD_LEVEL_M = 2.0
# Radio del buffer (grados ~ 1.1 km) para aproximar la zona desde el punto del sensor.
BUFFER_DEG = 0.01


@dataclass
class GaugeReading:
    station_id: str
    name: str
    lat: float
    lng: float
    water_level_m: float


class SiataGaugeClient(ABC):
    """Puerto: fuente de lecturas de estaciones de nivel."""

    @abstractmethod
    async def fetch_levels(self) -> List[GaugeReading]:
        ...


class StaticSeedSiataClient(SiataGaugeClient):
    """Adaptador seed con estaciones reales del geoportal SIATA (nivel simulado)."""

    # (station_id, nombre, lat, lng) — estaciones reales de la red de nivel SIATA.
    _STATIONS = [
        ("169", "Rio Medellin - La Clara", 6.1680, -75.6360),
        ("238", "Q. La Iguana - Nivel", 6.2700, -75.5900),
        ("342", "Hatillo - Rio Medellin-Aburra", 6.3870, -75.4760),
        ("584", "Rio Medellin - Estacion Metro Ayura", 6.1700, -75.5950),
        ("332", "La Presidenta Puente Peatonal Exito", 6.2080, -75.5660),
    ]

    async def fetch_levels(self) -> List[GaugeReading]:
        return [
            GaugeReading(station_id=sid, name=name, lat=lat, lng=lng, water_level_m=0.5)
            for sid, name, lat, lng in self._STATIONS
        ]


def level_to_status(water_level_m: float) -> FloodStatus:
    if water_level_m >= FLOOD_LEVEL_M:
        return FloodStatus.flooded
    if water_level_m >= WATCH_LEVEL_M:
        return FloodStatus.watch
    return FloodStatus.dry


class SiataSyncService:
    def __init__(self, client: SiataGaugeClient):
        self._client = client

    async def sync(self, db: AsyncSession) -> int:
        readings = await self._client.fetch_levels()
        for r in readings:
            geom = from_shape(Point(r.lng, r.lat).buffer(BUFFER_DEG), srid=4326)
            await crud_flood_hazard.upsert_flood_hazard_by_station(
                db,
                siata_station_id=r.station_id,
                name=r.name,
                status=level_to_status(r.water_level_m),
                water_level_m=r.water_level_m,
                geom=geom,
            )
        return len(readings)
