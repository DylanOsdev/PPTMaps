"""Endpoints públicos (sin auth) que alimentan el mapa del frontend.

Leen exclusivamente de las tablas reales (alerts, reports, flood_hazards, weather).
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
from app.db.redis import get_redis
from app.models.flood_hazard import FloodHazard
from app.models.report import Report, ReportType
from app.models.weather import WeatherSnapshot
from app.schemas.report import Report as SchemaReport, ReportCreate
from app.models.zone import Zone
from app.models.accident_incident import AccidentIncident
from app.services.weather import ForecastClient, OpenMeteoForecastClient

router = APIRouter()

# Umbral de probabilidad de lluvia (%) para considerar "riesgo de lluvia".
RAIN_RISK_THRESHOLD = 50


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


@router.get("/comunas/stats", summary="Accidentes por comuna (cruce espacial)")
async def public_comunas_stats(db: AsyncSession = Depends(get_db)):
    """Cuenta, por comuna (polígono), los accidentes que caen dentro vía ST_Contains."""
    rows = (
        await db.execute(
            text(
                """
                SELECT
                    z.name, z.slug, z.number,
                    COUNT(DISTINCT r.id) AS accident_count
                FROM zones z
                LEFT JOIN reports r
                    ON r.report_type = 'accident' AND ST_Contains(z.geom, r.geom)
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
        }
        for r in rows
    ]


@router.get("/reports", response_model=list[SchemaReport], summary="Todos los reportes ciudadanos públicos")
async def public_reports(
    report_type: Optional[ReportType] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    from app.crud import crud_report
    return await crud_report.get_reports(db, report_type=report_type, limit=limit)


@router.post("/reports", response_model=SchemaReport, status_code=201, summary="Crear reporte de incidente de forma pública")
async def create_public_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db)
):
    from app.crud import crud_report
    return await crud_report.create_report(db, report_in=report_in, reporter_id=None)


@router.get("/weather/stats", summary="Estadísticas de lluvia histórica (2008-2025)")
async def public_weather_stats(db: AsyncSession = Depends(get_db)):
    """Estadísticas de lluvia por año y mes desde datos históricos de Open-Meteo."""
    
    # Lluvia por año
    result_year = await db.execute(text("""
        SELECT 
            EXTRACT(YEAR FROM timestamp)::int as year,
            ROUND(SUM(precipitation_mm)::numeric, 1) as total_mm
        FROM historical_weather_medellin
        GROUP BY year
        ORDER BY year
    """))
    by_year = [{"year": str(row.year), "total_mm": float(row.total_mm)} for row in result_year.fetchall()]
    
    # Lluvia por mes (promedio de todos los años)
    result_month = await db.execute(text("""
        SELECT 
            EXTRACT(MONTH FROM timestamp)::int as month,
            ROUND(AVG(precipitation_mm)::numeric, 2) as avg_mm
        FROM historical_weather_medellin
        GROUP BY month
        ORDER BY month
    """))
    month_names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    by_month = [{"month": month_names[row.month - 1], "avg_mm": float(row.avg_mm)} for row in result_month.fetchall()]
    
    # Estadísticas generales
    result_stats = await db.execute(text("""
        SELECT 
            ROUND(AVG(precipitation_mm)::numeric, 2) as avg_hourly,
            ROUND(SUM(precipitation_mm)::numeric, 1) as total_all,
            COUNT(*) as total_hours
        FROM historical_weather_medellin
    """))
    stats = result_stats.fetchone()
    
    return {
        "by_year": by_year,
        "by_month": by_month,
        "avg_hourly_mm": float(stats.avg_hourly),
        "total_mm_18years": float(stats.total_all),
        "total_hours": stats.total_hours
    }


@router.get("/accident-zones", summary="Zonas de accidentalidad (clustering DBSCAN de 702k incidentes)")
async def public_accident_zones(limit: int = 0, db: AsyncSession = Depends(get_db)):  # limit=0 = sin límite
    """Zonas calientes de accidentes detectadas con DBSCAN sobre 702,540 registros históricos."""
    from app.models.accident_zone import AccidentZone
    
    query = select(
        AccidentZone.id,
        AccidentZone.name,
        AccidentZone.severity,
        AccidentZone.incident_count,
        ST_AsGeoJSON(AccidentZone.geom).label("geom_json"),
    ).order_by(desc(AccidentZone.severity), desc(AccidentZone.incident_count))  # Más peligrosas primero
    
    if limit > 0:
        query = query.limit(limit)
    
    rows = (await db.execute(query)).all()
    
    features = [
        {
            "type": "Feature",
            "geometry": json.loads(r.geom_json),
            "properties": {
                "id": r.id,
                "name": r.name,
                "severity": r.severity,
                "incident_count": r.incident_count,
            },
        }
        for r in rows
        if r.geom_json
    ]
    
    return {"type": "FeatureCollection", "features": features}


@router.get("/accidents/historical", summary="Accidentes históricos geolocalizados (702k incidentes 2008-2025)")
async def public_historical_accidents(
    limit: int = 1000,
    comuna: Optional[str] = None,
    severity: Optional[str] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """702,540 incidentes viales reales de Medellín. Fuente: Secretaría de Movilidad."""
    from app.models.accident_incident import AccidentIncident
    
    query = select(
        AccidentIncident.id,
        AccidentIncident.date,
        AccidentIncident.severity,
        AccidentIncident.incident_class,
        AccidentIncident.comuna,
        AccidentIncident.neighborhood,
        ST_Y(AccidentIncident.geom).label("lat"),
        ST_X(AccidentIncident.geom).label("lng"),
    )
    
    if comuna:
        query = query.where(AccidentIncident.comuna == comuna)
    if severity:
        query = query.where(AccidentIncident.severity == severity)
    if year:
        query = query.where(AccidentIncident.year == year)
    
    query = query.order_by(desc(AccidentIncident.date)).limit(limit)
    
    rows = (await db.execute(query)).all()
    
    return [
        {
            "id": r.id,
            "date": r.date.isoformat() if r.date else None,
            "severity": r.severity,
            "class": r.incident_class,
            "comuna": r.comuna,
            "neighborhood": r.neighborhood,
            "lat": r.lat,
            "lng": r.lng,
        }
        for r in rows
    ]


from app.services.routing import compute_route
from fastapi import Query, HTTPException

DEFAULT_ORIGIN = (6.2518, -75.5636)

def _parse_latlng(value: str) -> tuple[float, float]:
    try:
        lat, lng = (float(p) for p in value.split(","))
        return lat, lng
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Coordenada inválida; usar 'lat,lng'")


@router.get("/routes", summary="Ruta resiliente que esquiva zonas de riesgo activas")
async def get_route(
    destination: Optional[str] = Query(None, description="Destino como 'lat,lng'"),
    origin: Optional[str] = Query(None, description="Origen como 'lat,lng' (default centro Medellín)"),
    dest_lat: Optional[float] = Query(None, description="Latitud destino"),
    dest_lng: Optional[float] = Query(None, description="Longitud destino"),
    origin_lat: Optional[float] = Query(None, description="Latitud origen"),
    origin_lng: Optional[float] = Query(None, description="Longitud origen"),
    db: AsyncSession = Depends(get_db),
):
    if destination:
        dest = _parse_latlng(destination)
    elif dest_lat is not None and dest_lng is not None:
        dest = (dest_lat, dest_lng)
    else:
        raise HTTPException(status_code=422, detail="Se requiere destination o dest_lat y dest_lng")

    if origin:
        orig = _parse_latlng(origin)
    elif origin_lat is not None and origin_lng is not None:
        orig = (origin_lat, origin_lng)
    else:
        orig = DEFAULT_ORIGIN

    return await compute_route(db, orig, dest)
