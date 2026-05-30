"""Endpoints públicos (sin auth) que alimentan el mapa del frontend.

Leen exclusivamente de las tablas reales (telemetry, alerts, reports, flood_hazards).
No incluyen datos de fallback embebidos: si no hay datos, devuelven colecciones vacías.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends
from geoalchemy2.functions import ST_AsGeoJSON, ST_X, ST_Y
from sqlalchemy import desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_alert
from app.db.database import get_db
from app.models.flood_hazard import FloodHazard
from app.models.report import Report, ReportType
from app.models.weather import WeatherSnapshot
from app.models.zone import Zone
from app.models.accident_incident import AccidentIncident
from app.services.weather import ForecastClient, OpenMeteoForecastClient
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


# Centro de Medellín (Parque Berrío): punto de referencia del pronóstico del widget.
FORECAST_LAT, FORECAST_LNG = 6.2518, -75.5636


def get_forecast_client() -> ForecastClient:
    return OpenMeteoForecastClient()


@router.get("/weather/forecast", summary="Pronóstico detallado (actual + horario + diario) de Medellín")
async def public_weather_forecast(client: ForecastClient = Depends(get_forecast_client)):
    return await client.fetch_forecast(FORECAST_LAT, FORECAST_LNG)


async def _group_count(db: AsyncSession, column, limit: int | None = None):
    """Agrupa accident_incidents por una columna y cuenta, ignorando nulos."""
    q = (
        select(column.label("key"), func.count().label("count"))
        .where(column.isnot(None))
        .group_by(column)
        .order_by(func.count().desc())
    )
    if limit:
        q = q.limit(limit)
    rows = (await db.execute(q)).all()
    return [{"key": str(r.key), "count": r.count} for r in rows]


@router.get("/accidents/stats", summary="Estadísticas agregadas de accidentalidad (datos oficiales Medellín)")
async def public_accidents_stats(db: AsyncSession = Depends(get_db)):
    """Agregados para el dashboard analítico. Fuente: Secretaría de Movilidad de Medellín
    (dataset abierto Mendeley r6g5dfnpgh, CC BY 4.0)."""
    total = (await db.execute(select(func.count()).select_from(AccidentIncident))).scalar_one()
    return {
        "total": total,
        "by_severity": await _group_count(db, AccidentIncident.severity),
        "by_class": await _group_count(db, AccidentIncident.incident_class),
        "by_comuna": await _group_count(db, AccidentIncident.comuna, limit=10),
        "by_year": await _group_count(db, AccidentIncident.year),
    }


@router.get("/rain-risk", summary="Puntos con riesgo de lluvia en las próximas 2h")
async def public_rain_risk(db: AsyncSession = Depends(get_db)):
    return await _weather_rows(db, min_prob=RAIN_RISK_THRESHOLD)


# Contorno estático de la ciudad (no es una zona; lo usa el frontend para el borde).
_CITY = {
    "name": "Medellín",
    "department": "Antioquia",
    "country": "Colombia",
    "center": [6.2442, -75.5812],
    "outline": [
        [6.298, -75.632], [6.312, -75.595], [6.308, -75.558], [6.288, -75.528],
        [6.262, -75.512], [6.232, -75.518], [6.202, -75.535], [6.178, -75.562],
        [6.172, -75.598], [6.188, -75.628], [6.218, -75.642], [6.252, -75.638],
        [6.278, -75.635],
    ],
}


def _zone_item(row) -> dict:
    """Reconstruye el item con el contrato del frontend (geojson = Feature completo)."""
    feature = {
        "type": "Feature",
        "properties": {"name": row.name},
        "geometry": json.loads(row.geom_json),
    }
    item = {
        "name": row.name,
        "slug": row.slug,
        "center": [row.center_lat, row.center_lng],
        "geojson": feature,
    }
    if row.kind == "comuna":
        item["type"] = "comuna"
        item["number"] = row.number
    else:
        item["color"] = row.color
    return item


@router.get("/comunas", summary="Comunas y municipios del Valle de Aburrá (desde PostGIS)")
async def public_comunas(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(
                Zone.kind, Zone.name, Zone.slug, Zone.number,
                Zone.center_lat, Zone.center_lng, Zone.color,
                ST_AsGeoJSON(Zone.geom).label("geom_json"),
            ).order_by(Zone.kind, Zone.number, Zone.name)
        )
    ).all()
    comunas = [_zone_item(r) for r in rows if r.kind == "comuna" and r.geom_json]
    municipios = [_zone_item(r) for r in rows if r.kind == "municipio" and r.geom_json]
    return {"city": _CITY, "comunas": comunas, "municipios": municipios}


@router.get("/comunas/stats", summary="Accidentes y vehículos por comuna (cruce espacial)")
async def public_comunas_stats(db: AsyncSession = Depends(get_db)):
    """Cuenta, por comuna (polígono), los accidentes y la última posición de vehículos
    que caen dentro vía ST_Contains. Solo comunas (los municipios son puntos)."""
    rows = (
        await db.execute(
            text(
                """
                WITH last_pos AS (
                    SELECT DISTINCT ON (vehicle_id) vehicle_id, location
                    FROM telemetry
                    ORDER BY vehicle_id, timestamp DESC
                )
                SELECT
                    z.name, z.slug, z.number,
                    COUNT(DISTINCT r.id) AS accident_count,
                    COUNT(DISTINCT lp.vehicle_id) AS vehicle_count
                FROM zones z
                LEFT JOIN reports r
                    ON r.report_type = 'accident' AND ST_Contains(z.geom, r.geom)
                LEFT JOIN last_pos lp
                    ON ST_Contains(z.geom, lp.location)
                WHERE z.kind = 'comuna'
                GROUP BY z.name, z.slug, z.number
                ORDER BY z.number NULLS LAST, z.name
                """
            )
        )
    ).all()
    return [
        {
            "name": r.name,
            "slug": r.slug,
            "number": r.number,
            "accident_count": r.accident_count,
            "vehicle_count": r.vehicle_count,
        }
        for r in rows
    ]
