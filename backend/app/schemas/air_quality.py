"""Schemas Pydantic para Air Quality."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class AirQualityReadingBase(BaseModel):
    """Schema base para AirQualityReading."""
    station_id: str
    station_name: Optional[str] = None
    aqi: Optional[int] = None
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    o3: Optional[float] = None
    so2: Optional[float] = None
    temp: Optional[float] = None
    humidity: Optional[float] = None
    timestamp: datetime


class AirQualityReading(AirQualityReadingBase):
    """Schema completo para lectura (response)."""
    id: int
    lat: float
    lng: float
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class AirQualityFeature(BaseModel):
    """Feature GeoJSON para una estación."""
    type: str = "Feature"
    geometry: dict
    properties: dict


class AirQualityMap(BaseModel):
    """GeoJSON FeatureCollection para el mapa."""
    type: str = "FeatureCollection"
    features: List[AirQualityFeature]


class ComunaAQI(BaseModel):
    """AQI agregado por comuna."""
    comuna_name: str
    aqi_avg: Optional[float] = None
    station_count: int
    last_update: Optional[datetime] = None
