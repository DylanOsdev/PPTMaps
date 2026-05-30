"""Endpoints públicos (sin auth) que alimentan el mapa del frontend.

Leen exclusivamente de las tablas reales (telemetry, alerts, reports, flood_hazards).
No incluyen datos de fallback embebidos: si no hay datos, devuelven colecciones vacías.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends
from geoalchemy2.functions import ST_AsGeoJSON, ST_X, ST_Y
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_alert
from app.db.database import get_db
from app.models.flood_hazard import FloodHazard
from app.models.report import Report, ReportType
from app.models.weather import WeatherSnapshot
from app.websocket.ws_router import _latest_telemetry

router = APIRouter()

# Umbral de probabilidad de lluvia (%) para considerar "riesgo de lluvia".
RAIN_RISK_THRESHOLD = 50


@router.get("/telemetry/latest", summary="Última posición conocida de cada vehículo")
async def public_telemetry_latest(db: AsyncSession = Depends(get_db)):
    return await _latest_telemetry(db)


@router.get("/alerts", summary="Alertas activas")
async def public_alerts(
    is_resolved: Optional[bool] = False,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    alerts = await crud_alert.get_alerts(db, is_resolved=is_resolved, limit=limit)
    return [
        {
            "id": str(a.id),
            "type": a.type.lower(),
            "severity": a.severity.value if hasattr(a.severity, "value") else str(a.severity),
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "is_resolved": a.is_resolved,
        }
        for a in alerts
    ]


async def _accidents_feature_collection(db: AsyncSession, limit: int) -> dict:
    rows = (
        await db.execute(
            select(
                Report.id,
                Report.description,
                Report.created_at,
                ST_AsGeoJSON(Report.geom).label("geom_json"),
            )
            .where(Report.report_type == ReportType.accident)
            .order_by(desc(Report.created_at))
            .limit(limit)
        )
    ).all()
    features = [
        {
            "type": "Feature",
            "geometry": json.loads(r.geom_json),
            "properties": {
                "id": r.id,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            },
        }
        for r in rows
        if r.geom_json
    ]
    return {"type": "FeatureCollection", "features": features}


@router.get("/accidents/geojson", summary="Incidentes de accidente en GeoJSON")
async def public_accidents_geojson(limit: int = 100, db: AsyncSession = Depends(get_db)):
    return await _accidents_feature_collection(db, limit)


@router.get("/fatalities", summary="Accidentes graves en GeoJSON")
async def public_fatalities(limit: int = 100, db: AsyncSession = Depends(get_db)):
    # Sin campo de gravedad en reports, exponemos los accidentes reales como capa base.
    return await _accidents_feature_collection(db, limit)


@router.get("/flood-zones", summary="Zonas de riesgo de inundación")
async def public_flood_zones(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(
                FloodHazard.id,
                FloodHazard.name,
                FloodHazard.siata_station_id,
                FloodHazard.status,
                FloodHazard.water_level_m,
                ST_AsGeoJSON(FloodHazard.geom).label("geom_json"),
            )
        )
    ).all()
    # Array plano: el frontend (updateFloodZones) espera [{id, name, status, geom}]
    # donde geom es la geometría GeoJSON directa (no un Feature).
    return [
        {
            "id": r.id,
            "name": r.name,
            "siata_station_id": r.siata_station_id,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "water_level_m": r.water_level_m,
            "geom": json.loads(r.geom_json),
        }
        for r in rows
        if r.geom_json
    ]


async def _weather_rows(db: AsyncSession, min_prob: int | None = None):
    query = select(
        WeatherSnapshot.location_name,
        ST_Y(WeatherSnapshot.geom).label("lat"),
        ST_X(WeatherSnapshot.geom).label("lng"),
        WeatherSnapshot.temperature_c,
        WeatherSnapshot.humidity,
        WeatherSnapshot.rain_mm,
        WeatherSnapshot.precipitation_prob_2h,
        WeatherSnapshot.weather_code,
        WeatherSnapshot.recorded_at,
    )
    if min_prob is not None:
        query = query.where(WeatherSnapshot.precipitation_prob_2h >= min_prob)
    rows = (await db.execute(query)).all()
    return [
        {
            "location_name": r.location_name,
            "lat": r.lat,
            "lng": r.lng,
            "temperature_c": r.temperature_c,
            "humidity": r.humidity,
            "rain_mm": r.rain_mm,
            "precipitation_prob_2h": r.precipitation_prob_2h,
            "weather_code": r.weather_code,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
        }
        for r in rows
    ]


@router.get("/weather", summary="Clima actual por punto del Valle de Aburrá")
async def public_weather(db: AsyncSession = Depends(get_db)):
    return await _weather_rows(db)


@router.get("/rain-risk", summary="Puntos con riesgo de lluvia en las próximas 2h")
async def public_rain_risk(db: AsyncSession = Depends(get_db)):
    return await _weather_rows(db, min_prob=RAIN_RISK_THRESHOLD)
