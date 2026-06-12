"""Servicio de sync calidad del aire (arquitectura hexagonal)."""
import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

import httpx
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.air_quality_reading import AirQualityReading

logger = logging.getLogger(__name__)

WAQI_API_URL = "https://api.waqi.info/feed"


@dataclass
class AirQualityData:
    """Data transfer object para una lectura de calidad del aire."""
    station_id: str
    station_name: str
    lat: float
    lng: float
    aqi: int
    pm25: float
    pm10: float
    no2: float
    o3: float
    so2: float
    temp: float
    humidity: float
    timestamp: datetime


class AirQualityClient(ABC):
    """Puerto: fuente de lecturas de calidad del aire."""
    
    @abstractmethod
    async def fetch_readings(self) -> List[AirQualityData]:
        """Obtiene lecturas de calidad del aire de la fuente."""
        ...


class AQISeedClient(AirQualityClient):
    """Adaptador seed con 5 estaciones demo del Valle de Aburrá."""
    
    _STATIONS = [
        ("H12627", "Belén", 6.2322, -75.5877),
        ("H12635", "El Poblado", 6.2100, -75.5700),
        ("H12513", "Aranjuez", 6.2730, -75.5530),
        ("H12637", "La Estrella", 6.1580, -75.6370),
        ("H12626", "Bello", 6.3370, -75.5560),
    ]
    
    _BASE_AQI = {
        "H12627": 63,
        "H12635": 55,
        "H12513": 70,
        "H12637": 58,
        "H12626": 68,
    }
    
    async def fetch_readings(self) -> List[AirQualityData]:
        """Retorna 5 estaciones con variación pseudoaleatoria cada 5 min."""
        seed = int(datetime.now(timezone.utc).timestamp() // 300)
        rng = random.Random(seed)
        readings: List[AirQualityData] = []
        
        for sid, name, lat, lng in self._STATIONS:
            base_aqi = self._BASE_AQI.get(sid, 60)
            variation = rng.uniform(-0.3, 0.3)
            aqi = max(10, int(base_aqi * (1 + variation)))
            pm25 = max(5.0, round(aqi * 0.3, 1))
            
            readings.append(
                AirQualityData(
                    station_id=sid,
                    station_name=name,
                    lat=lat,
                    lng=lng,
                    aqi=aqi,
                    pm25=pm25,
                    pm10=round(pm25 * 1.5, 1),
                    no2=round(rng.uniform(8.0, 15.0), 1),
                    o3=round(rng.uniform(30.0, 50.0), 1),
                    so2=round(rng.uniform(3.0, 8.0), 1),
                    temp=round(rng.uniform(18.0, 26.0), 1),
                    humidity=round(rng.uniform(50.0, 80.0), 1),
                    timestamp=datetime.now(timezone.utc).replace(second=0, microsecond=0)
                )
            )
        
        return readings


class WAQIHttpClient(AirQualityClient):
    """Adaptador HTTP real: consulta WAQI API para estaciones de Medellín."""
    
    # IDs de estaciones WAQI del Valle de Aburrá (21 estaciones reales)
    _STATION_IDS = [
        "H12627", "H12635", "H12513", "H12637", "H12626",
        "H12628", "H12511", "H12639", "H12638", "H12636",
        "H12510", "H12512", "H12514", "556204", "556216",
        "8242", "556213", "556210", "556207", "@12635", "@12627"
    ]
    
    def __init__(self, api_token: str):
        self.api_token = api_token
    
    async def fetch_readings(self) -> List[AirQualityData]:
        """Consulta API WAQI para obtener lecturas de 21 estaciones."""
        readings: List[AirQualityData] = []
        
        async with httpx.AsyncClient(timeout=30) as client:
            for station_id in self._STATION_IDS[:5]:  # Limitar a 5 para demo
                try:
                    url = f"{WAQI_API_URL}/@{station_id}/?token={self.api_token}"
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    
                    data = resp.json()
                    if data.get("status") != "ok":
                        continue
                    
                    station = data["data"]
                    iaqi = station.get("iaqi", {})
                    
                    readings.append(
                        AirQualityData(
                            station_id=station_id,
                            station_name=station.get("city", {}).get("name", "Unknown"),
                            lat=station["city"]["geo"][0],
                            lng=station["city"]["geo"][1],
                            aqi=station.get("aqi", 0),
                            pm25=iaqi.get("pm25", {}).get("v", 0.0),
                            pm10=iaqi.get("pm10", {}).get("v", 0.0),
                            no2=iaqi.get("no2", {}).get("v", 0.0),
                            o3=iaqi.get("o3", {}).get("v", 0.0),
                            so2=iaqi.get("so2", {}).get("v", 0.0),
                            temp=iaqi.get("t", {}).get("v", 0.0),
                            humidity=iaqi.get("h", {}).get("v", 0.0),
                            timestamp=datetime.fromisoformat(station["time"]["iso"])
                        )
                    )
                except Exception as e:
                    logger.warning(f"Error fetching station {station_id}: {e}")
                    continue
        
        logger.info(f"WAQI real: {len(readings)} estaciones obtenidas")
        return readings


class AirQualitySyncService:
    """Servicio que sincroniza lecturas de calidad del aire a PostGIS."""
    
    def __init__(self, client: AirQualityClient):
        self._client = client
    
    async def sync(self, db: AsyncSession) -> int:
        """Sincroniza lecturas del client a la BD. Retorna count de inserciones."""
        readings = await self._client.fetch_readings()
        inserted = 0
        
        for r in readings:
            geom = from_shape(Point(r.lng, r.lat), srid=4326)
            
            # Insert con ON CONFLICT DO NOTHING para detectar duplicados
            stmt = pg_insert(AirQualityReading).values(
                station_id=r.station_id,
                station_name=r.station_name,
                geom=geom,
                aqi=r.aqi,
                pm25=r.pm25,
                pm10=r.pm10,
                no2=r.no2,
                o3=r.o3,
                so2=r.so2,
                temp=r.temp,
                humidity=r.humidity,
                timestamp=r.timestamp
            ).on_conflict_do_nothing(
                index_elements=['station_id', 'timestamp']
            )
            
            result = await db.execute(stmt)
            if result.rowcount > 0:
                inserted += 1
        
        await db.commit()
        logger.info(f"Air quality sync: {inserted} readings inserted, {len(readings) - inserted} duplicates skipped")
        return inserted


async def _create_air_quality_client(api_token: str = "") -> AirQualityClient:
    """Factory: intenta crear cliente HTTP real, si falla retorna seed."""
    if not api_token:
        logger.info("WAQI token not configured, using seed client")
        return AQISeedClient()
    
    try:
        # Quick test del token
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{WAQI_API_URL}/here/?token={api_token}")
            if resp.status_code == 200:
                logger.info("WAQI API available, using HTTP client")
                return WAQIHttpClient(api_token)
    except Exception as e:
        logger.warning(f"WAQI API unavailable: {e}, using seed client")
    
    return AQISeedClient()
