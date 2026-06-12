"""Servicio de sync eventos climáticos desde SIATA (arquitectura hexagonal)."""
import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import List

import httpx
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.weather_event import WeatherEvent

logger = logging.getLogger(__name__)

SIATA_RAINFALL_URL = "https://siata.gov.co/descargasiata/index.php/rest/Precipitacion/datos"
SIATA_LIGHTNING_URL = "https://siata.gov.co/descargasiata/index.php/rest/Rayos/datos"


@dataclass
class WeatherEventData:
    """Data transfer object para un evento climático."""
    event_type: str  # "rainfall", "lightning", "hail", "storm"
    severity: int
    intensity: float
    lat: float
    lng: float
    timestamp: datetime
    source: str = "SIATA"


class WeatherEventClient(ABC):
    """Puerto: fuente de eventos climáticos."""
    
    @abstractmethod
    async def fetch_events(self) -> List[WeatherEventData]:
        """Obtiene eventos climáticos de la fuente."""
        ...


class SeedWeatherClient(WeatherEventClient):
    """Adaptador: datos de demostración."""
    
    async def fetch_events(self) -> List[WeatherEventData]:
        """Genera eventos climáticos sintéticos para Medellín."""
        logger.info("🌧️ Usando eventos climáticos SEED (fallback)")
        
        # Coordenadas de barrios de Medellín
        locations = [
            (6.2442, -75.5812, "El Poblado"),
            (6.2308, -75.5906, "Laureles"),
            (6.2522, -75.5636, "Buenos Aires"),
            (6.2753, -75.5696, "Aranjuez"),
            (6.2086, -75.5936, "Belén"),
            (6.1989, -75.5794, "La América"),
            (6.2906, -75.5547, "Castilla"),
            (6.3386, -75.5747, "Bello"),
            (6.1652, -75.6061, "Envigado"),
            (6.1711, -75.5683, "Itagüí"),
        ]
        
        events = []
        now = datetime.now()  # NAIVE timestamp to match model
        
        # Generar 8-12 eventos recientes (última hora)
        for _ in range(random.randint(8, 12)):
            lat, lng, zone = random.choice(locations)
            
            # Variar coordenadas para dispersión
            lat += random.uniform(-0.01, 0.01)
            lng += random.uniform(-0.01, 0.01)
            
            # Tipo de evento con distribución realista
            event_type = random.choices(
                ["rainfall", "lightning", "storm", "hail"],
                weights=[60, 25, 10, 5]  # lluvia más común
            )[0]
            
            # Severidad e intensidad según tipo
            if event_type == "rainfall":
                intensity = random.uniform(5.0, 50.0)  # mm/h
                severity = 1 if intensity < 10 else (3 if intensity < 30 else 5)
            elif event_type == "lightning":
                intensity = random.uniform(10.0, 100.0)  # kA
                severity = random.randint(2, 4)
            elif event_type == "storm":
                intensity = random.uniform(30.0, 80.0)  # mm/h + viento
                severity = random.randint(3, 5)
            else:  # hail
                intensity = random.uniform(5.0, 20.0)  # mm diámetro
                severity = random.randint(4, 5)
            
            # Timestamp en la última hora
            minutes_ago = random.randint(5, 60)
            timestamp = now - timedelta(minutes=minutes_ago)
            
            events.append(WeatherEventData(
                event_type=event_type,
                severity=severity,
                intensity=round(intensity, 2),
                lat=lat,
                lng=lng,
                timestamp=timestamp,
                source="SIATA_SEED"
            ))
        
        logger.info(f"✅ Generados {len(events)} eventos climáticos sintéticos")
        return events


class SIATAHttpClient(WeatherEventClient):
    """Adaptador: SIATA API real."""
    
    def __init__(self, api_token: str | None = None):
        self.api_token = api_token
        self.timeout = 10.0
    
    async def fetch_events(self) -> List[WeatherEventData]:
        """Obtiene eventos reales de SIATA (lluvia + rayos)."""
        logger.info("🌩️ Fetching eventos climáticos desde SIATA API")
        
        events = []
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 1. Obtener datos de precipitación
                rainfall_events = await self._fetch_rainfall(client)
                events.extend(rainfall_events)
                
                # 2. Obtener datos de rayos
                lightning_events = await self._fetch_lightning(client)
                events.extend(lightning_events)
        
        except Exception as e:
            logger.warning(f"⚠️ Error fetching SIATA API: {e}. Usando seed fallback.")
            # Fallback a datos sintéticos
            seed_client = SeedWeatherClient()
            return await seed_client.fetch_events()
        
        logger.info(f"✅ Obtenidos {len(events)} eventos climáticos desde SIATA")
        return events
    
    async def _fetch_rainfall(self, client: httpx.AsyncClient) -> List[WeatherEventData]:
        """Obtiene datos de precipitación."""
        events = []
        try:
            # SIATA requiere fecha en formato YYYY-MM-DD
            today = datetime.now().strftime("%Y-%m-%d")
            params = {"fecha": today}
            
            response = await client.get(SIATA_RAINFALL_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Parsear respuesta SIATA
            for record in data.get("data", [])[:20]:  # Limitar a últimas 20 estaciones
                try:
                    intensity = float(record.get("valorPrecipitacion", 0))
                    if intensity < 0.1:  # Ignorar valores insignificantes
                        continue
                    
                    lat = float(record["latitud"])
                    lng = float(record["longitud"])
                    timestamp_str = record.get("fechahora")
                    
                    # Parsear timestamp SIATA (formato: "2026-06-11 22:00:00")
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                    
                    # Clasificar severidad
                    if intensity < 5:
                        severity = 1
                    elif intensity < 15:
                        severity = 2
                    elif intensity < 30:
                        severity = 3
                    elif intensity < 50:
                        severity = 4
                    else:
                        severity = 5
                    
                    events.append(WeatherEventData(
                        event_type="rainfall",
                        severity=severity,
                        intensity=intensity,
                        lat=lat,
                        lng=lng,
                        timestamp=timestamp,
                        source="SIATA"
                    ))
                except (KeyError, ValueError) as e:
                    logger.debug(f"Skipping malformed rainfall record: {e}")
                    continue
        
        except Exception as e:
            logger.warning(f"Error fetching rainfall data: {e}")
        
        return events
    
    async def _fetch_lightning(self, client: httpx.AsyncClient) -> List[WeatherEventData]:
        """Obtiene datos de rayos."""
        events = []
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            params = {"fecha": today}
            
            response = await client.get(SIATA_LIGHTNING_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get("data", [])[:30]:  # Limitar a últimos 30 rayos
                try:
                    intensity = float(record.get("corriente", 0))  # kA
                    lat = float(record["latitud"])
                    lng = float(record["longitud"])
                    timestamp_str = record.get("fechahora")
                    
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                    
                    # Rayos siempre son severidad media-alta
                    severity = 3 if abs(intensity) < 50 else 4
                    
                    events.append(WeatherEventData(
                        event_type="lightning",
                        severity=severity,
                        intensity=abs(intensity),
                        lat=lat,
                        lng=lng,
                        timestamp=timestamp,
                        source="SIATA"
                    ))
                except (KeyError, ValueError) as e:
                    logger.debug(f"Skipping malformed lightning record: {e}")
                    continue
        
        except Exception as e:
            logger.warning(f"Error fetching lightning data: {e}")
        
        return events


async def sync_weather_events(db: AsyncSession, client: WeatherEventClient | None = None) -> int:
    """
    Sincroniza eventos climáticos desde SIATA.
    
    Args:
        db: Sesión de base de datos async
        client: Cliente opcional (para testing). Si es None, usa SIATA real con fallback a seed.
    
    Returns:
        Cantidad de eventos insertados
    """
    if client is None:
        # Demo/Development: usar datos sintéticos por defecto
        # Para producción con SIATA real, pasar SIATAHttpClient() explícitamente
        client = SeedWeatherClient()
    
    # Fetch eventos
    events = await client.fetch_events()
    
    if not events:
        logger.info("⚠️ No hay eventos climáticos para sincronizar")
        return 0
    
    # Preparar datos para insert
    values = []
    for event in events:
        point = Point(event.lng, event.lat)
        values.append({
            "event_type": event.event_type,
            "severity": event.severity,
            "intensity": event.intensity,
            "timestamp": event.timestamp,
            "source": event.source,
            "geom": from_shape(point, srid=4326),
        })
    
    # Insert uno por uno para manejar duplicados correctamente
    inserted = 0
    for value in values:
        try:
            stmt = pg_insert(WeatherEvent).values(value)
            await db.execute(stmt)
            await db.commit()
            inserted += 1
        except Exception as e:
            # Duplicado o error — rollback y continuar
            await db.rollback()
            logger.error(f"❌ Evento no insertado: {type(e).__name__}: {e}")
            continue
    
    logger.info(f"✅ Sincronizados {inserted}/{len(events)} eventos climáticos")
    
    return inserted
