"""Endpoints públicos de Air Quality."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.crud import crud_air_quality
from app.schemas.air_quality import (
    AirQualityReading,
    AirQualityMap,
    ComunaAQI
)

router = APIRouter()


@router.get("/current", response_model=List[AirQualityReading])
async def get_current_readings(db: AsyncSession = Depends(get_db)):
    """Obtiene las últimas lecturas de calidad del aire (una por estación)."""
    readings = await crud_air_quality.get_latest_readings(db)
    return readings


@router.get("/station/{station_id}", response_model=List[AirQualityReading])
async def get_station_history(
    station_id: str,
    hours: int = 168,
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el histórico de una estación específica (default: última semana)."""
    readings = await crud_air_quality.get_by_station(db, station_id, hours)
    if not readings:
        raise HTTPException(status_code=404, detail="Station not found or no data")
    return readings


@router.get("/map", response_model=AirQualityMap)
async def get_air_quality_map(db: AsyncSession = Depends(get_db)):
    """Retorna GeoJSON con las últimas lecturas para renderizar en mapa."""
    readings = await crud_air_quality.get_latest_readings(db)
    
    features = []
    for reading in readings:
        # Extraer coordenadas de la geometría PostGIS
        from geoalchemy2.shape import to_shape
        point = to_shape(reading.geom)
        
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [point.x, point.y]
            },
            "properties": {
                "station_id": reading.station_id,
                "station_name": reading.station_name,
                "aqi": reading.aqi,
                "pm25": reading.pm25,
                "pm10": reading.pm10,
                "no2": reading.no2,
                "o3": reading.o3,
                "so2": reading.so2,
                "temp": reading.temp,
                "humidity": reading.humidity,
                "timestamp": reading.timestamp.isoformat() if reading.timestamp else None
            }
        })
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/by-comuna", response_model=List[ComunaAQI])
async def get_aqi_by_comuna(db: AsyncSession = Depends(get_db)):
    """Obtiene AQI promedio por comuna (agregado de estaciones cercanas)."""
    results = await crud_air_quality.get_by_comuna(db)
    return results
