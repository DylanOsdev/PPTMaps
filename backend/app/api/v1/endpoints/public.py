"""Endpoints públicos (sin auth) que alimentan el mapa del frontend.

Leen exclusivamente de las tablas reales (alerts, reports, flood_hazards, weather).
No incluyen datos de fallback embebidos: si no hay datos, devuelven colecciones vacías.
"""
import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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
        "by_comuna": await _group_count(db, AccidentIncident.comuna),  # sin límite = todas
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


@router.get("/weather/historical/comunas", summary="Precipitación histórica por comuna (GeoJSON)")
async def public_weather_historical_comunas(
    year: Optional[int] = Query(None, description="Año (default: último disponible)"),
    db: AsyncSession = Depends(get_db),
):
    """Polígonos de comunas coloreados por precipitación total del año seleccionado.
    Cada comuna hereda los datos de la celda ERA5-Land más cercana."""
    if not year:
        result = await db.execute(text("""
            SELECT MAX(EXTRACT(YEAR FROM timestamp)::int) FROM historical_weather_grid
        """))
        year = result.scalar()

    rows = await db.execute(text("""
        WITH yearly_precip AS (
            SELECT grid_cell_lat, grid_cell_lng,
                   ROUND(SUM(precipitation_mm)::numeric, 1) as total_mm,
                   ROUND(AVG(precipitation_mm)::numeric, 2) as avg_mm,
                   COUNT(*) as record_count
            FROM historical_weather_grid
            WHERE timestamp >= :start_ts AND timestamp < :end_ts
            GROUP BY grid_cell_lat, grid_cell_lng
        ),
        comuna_assignment AS (
            SELECT DISTINCT ON (z.id)
                z.number, z.name, z.geom,
                y.total_mm, y.avg_mm, y.record_count
            FROM zones z
            CROSS JOIN yearly_precip y
            WHERE z.kind = 'comuna'
            ORDER BY z.id, ST_Distance(
                ST_Centroid(z.geom),
                ST_SetSRID(ST_MakePoint(y.grid_cell_lng, y.grid_cell_lat), 4326)
            )
        )
        SELECT number, name, total_mm, avg_mm, record_count,
               ST_AsGeoJSON(geom) as geom_json
        FROM comuna_assignment
        ORDER BY number
    """), {"start_ts": date(year, 1, 1), "end_ts": date(year + 1, 1, 1)})

    features = []
    for row in rows.fetchall():
        features.append({
            "type": "Feature",
            "geometry": json.loads(row.geom_json),
            "properties": {
                "comuna": row.number,
                "nombre": row.name,
                "total_mm": float(row.total_mm),
                "avg_mm": float(row.avg_mm),
                "record_count": row.record_count,
            },
        })

    return {"type": "FeatureCollection", "features": features, "year": year}


@router.get("/weather/historical/grid", summary="Celdas ERA5-Land con precipitación anual (GeoJSON)")
async def public_weather_historical_grid(
    year: Optional[int] = Query(None, description="Año (default: último disponible)"),
    db: AsyncSession = Depends(get_db),
):
    """FeatureCollection con un Point por celda ERA5-Land, cada una con su precipitación total del año."""
    if not year:
        result = await db.execute(text("""
            SELECT MAX(EXTRACT(YEAR FROM timestamp)::int) FROM historical_weather_grid
        """))
        year = result.scalar()

    rows = await db.execute(text("""
        SELECT grid_cell_lat, grid_cell_lng,
               ROUND(SUM(precipitation_mm)::numeric, 1) as total_mm,
               ROUND(AVG(precipitation_mm)::numeric, 2) as avg_mm,
               COUNT(*) as record_count
        FROM historical_weather_grid
        WHERE timestamp >= :start_ts AND timestamp < :end_ts
        GROUP BY grid_cell_lat, grid_cell_lng
        ORDER BY grid_cell_lat, grid_cell_lng
    """), {"start_ts": date(year, 1, 1), "end_ts": date(year + 1, 1, 1)})

    features = []
    for row in rows.fetchall():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row.grid_cell_lng, row.grid_cell_lat],
            },
            "properties": {
                "total_mm": float(row.total_mm),
                "avg_mm": float(row.avg_mm),
                "record_count": row.record_count,
            },
        })

    return {"type": "FeatureCollection", "features": features, "year": year}


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
    limit: int = 5000,
    comuna: Optional[str] = None,
    severity: Optional[str] = None,
    severities: Optional[list[str]] = Query(None),
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """702,540 incidentes viales reales de Medellín. Fuente: Secretaría de Movilidad.
    Retorna GeoJSON FeatureCollection con color por severidad para renderizado directo."""
    from app.models.accident_incident import AccidentIncident
    
    SEVERITY_COLORS = {"MUERTO": "#ef4444", "HERIDO": "#f59e0b", "SOLO DAÑOS": "#22c55e"}
    
    query = select(
        AccidentIncident.id,
        AccidentIncident.incident_date,
        AccidentIncident.severity,
        AccidentIncident.incident_class,
        AccidentIncident.comuna,
        AccidentIncident.barrio,
        ST_Y(AccidentIncident.geom).label("lat"),
        ST_X(AccidentIncident.geom).label("lng"),
    )
    
    if comuna:
        query = query.where(AccidentIncident.comuna == comuna)
    if severities:
        query = query.where(AccidentIncident.severity.in_(severities))
    elif severity:
        query = query.where(AccidentIncident.severity == severity)
    if year:
        query = query.where(AccidentIncident.year == year)
    
    query = query.order_by(desc(AccidentIncident.incident_date)).limit(limit)
    
    rows = (await db.execute(query)).all()
    
    features = []
    for r in rows:
        if r.lat is None or r.lng is None:
            continue
        sev = r.severity or "SOLO DAÑOS"
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [r.lng, r.lat]},
            "properties": {
                "id": r.id,
                "date": r.incident_date.isoformat() if r.incident_date else None,
                "severity": sev,
                "class": r.incident_class,
                "comuna": r.comuna,
                "barrio": r.barrio,
                "marker-color": SEVERITY_COLORS.get(sev, "#22c55e"),
            }
        })
    
    return {"type": "FeatureCollection", "features": features}


@router.get("/accidents/historical/heatmap", summary="Heatmap de accidentes históricos (702k)")
async def public_historical_accidents_heatmap(
    comuna: Optional[str] = None,
    severities: Optional[list[str]] = Query(None),
    year: Optional[int] = None,
    grid: float = Query(0.001, description="Tamaño de celda en grados (~100m)"),
    db: AsyncSession = Depends(get_db),
):
    """Grilla de calor espacial. Agrupa los 702k incidentes en celdas de ~100m
    y devuelve [lat, lng, peso_acumulado] para renderizar con L.heatLayer.
    Peso: MUERTO=1.0, HERIDO=0.7, SOLO DAÑOS=0.4"""
    scale = round(1.0 / grid)

    clauses = ["geom IS NOT NULL"]
    params = {}
    if comuna:
        clauses.append("comuna = :comuna")
        params["comuna"] = comuna
    if severities:
        placeholders = [f":sev_{i}" for i in range(len(severities))]
        clauses.append(f"severity IN ({', '.join(placeholders)})")
        for i, s in enumerate(severities):
            params[f"sev_{i}"] = s
    if year:
        clauses.append("year = :year")
        params["year"] = year

    sql = f"""
        SELECT
            FLOOR(ST_Y(geom) * {scale}) / {scale}::double precision as lat,
            FLOOR(ST_X(geom) * {scale}) / {scale}::double precision as lng,
            SUM(
                CASE severity
                    WHEN 'MUERTO' THEN 1.0
                    WHEN 'HERIDO' THEN 0.7
                    ELSE 0.4
                END
            ) as weight
        FROM accident_incidents
        WHERE {' AND '.join(clauses)}
        GROUP BY FLOOR(ST_Y(geom) * {scale}), FLOOR(ST_X(geom) * {scale})
        ORDER BY weight DESC
    """

    rows = (await db.execute(text(sql), params)).all()

    points = [[float(r.lat), float(r.lng), float(r.weight)] for r in rows]
    max_weight = float(max(p[2] for p in points)) if points else 0
    weights = sorted([p[2] for p in points])
    p80_weight = float(weights[int(len(weights) * 0.80)]) if weights else max_weight
    normalizer = p80_weight if p80_weight > 0 else (max_weight or 500)
    return {"points": points, "total": len(points), "grid_deg": grid, "max_weight": max_weight, "normalizer": normalizer}


from app.services.routing import compute_route
from fastapi import Query, HTTPException

DEFAULT_ORIGIN = (6.2518, -75.5636)  # Centro Medellín

def _parse_latlng(value: str) -> tuple[float, float]:
    try:
        lat, lng = (float(p) for p in value.split(","))
        return lat, lng
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Coordenada inválida; usar 'lat,lng'")


@router.get("/routes/safe-weather", summary="Ruta resiliente que evita zonas climáticas de alto riesgo")
async def get_safe_weather_route(
    destination: Optional[str] = Query(None, description="Destino como 'lat,lng'"),
    origin: Optional[str] = Query(None, description="Origen como 'lat,lng' (default centro Medellín)"),
    dest_lat: Optional[float] = Query(None, description="Latitud destino"),
    dest_lng: Optional[float] = Query(None, description="Longitud destino"),
    origin_lat: Optional[float] = Query(None, description="Latitud origen"),
    origin_lng: Optional[float] = Query(None, description="Longitud origen"),
    db: AsyncSession = Depends(get_db),
):
    """Calcula ruta evitando tormentas activas, zonas de rayos/granizo, y zonas de inundación."""
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

@router.get("/routes", summary="Alias de /routes/safe-weather para compatibilidad frontend")
async def get_route_alias(
    destination: Optional[str] = Query(None, description="Destino como 'lat,lng'"),
    origin: Optional[str] = Query(None, description="Origen como 'lat,lng' (default centro Medellín)"),
    dest_lat: Optional[float] = Query(None, description="Latitud destino"),
    dest_lng: Optional[float] = Query(None, description="Longitud destino"),
    origin_lat: Optional[float] = Query(None, description="Latitud origen"),
    origin_lng: Optional[float] = Query(None, description="Longitud origen"),
    db: AsyncSession = Depends(get_db),
):
    """Calcula ruta evitando tormentas activas, zonas de rayos/granizo, y zonas de inundación."""
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


@router.get("/accident-risk", summary="Riesgo de accidente en un punto (clima + históricos)")
async def accident_risk_point(
    lat: float,
    lng: float,
    db: AsyncSession = Depends(get_db),
):
    from app.ml.feature_pipeline import build_inference_features
    from app.ml.risk_model import SimpleRiskModel
    from datetime import datetime

    features = await build_inference_features(db, lat, lng)
    model = SimpleRiskModel.get_instance()
    if not model.is_trained:
        model.train([])
    score = model.predict(features)

    return {
        "risk_score": score,
        "comuna": None,
        "model": "climate-risk-v1",
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/accident-risk/heatmap", summary="Grid de riesgo de accidentes para heatmap")
async def accident_risk_heatmap(
    db: AsyncSession = Depends(get_db),
):
    import asyncio
    import json
    from app.ml.feature_pipeline import RiskFeatures, build_inference_features
    from app.ml.risk_model import SimpleRiskModel
    from datetime import datetime
    from sqlalchemy import text as sql_text

    try:
        from app.db.redis import get_redis
        r = get_redis()
        cached = await r.get("heatmap:accident-risk")
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    model = SimpleRiskModel.get_instance()
    if not model.is_trained:
        model.train([])

    rows = await db.execute(
        sql_text("""
            SELECT
                ST_Y(geom::geometry) AS lat,
                ST_X(geom::geometry) AS lng
            FROM accident_incidents
            WHERE geom IS NOT NULL
            ORDER BY random()
            LIMIT 20
        """)
    )
    candidates = [(r.lat, r.lng) for r in rows]
    tasks = [build_inference_features(db, lat, lng) for lat, lng in candidates]
    features = await asyncio.gather(*tasks, return_exceptions=True)

    points = []
    for (lat, lng), f in zip(candidates, features):
        if isinstance(f, Exception):
            continue
        try:
            score = model.predict(f)
            if score > 0.1:
                points.append({
                    "lat": round(lat, 6),
                    "lng": round(lng, 6),
                    "risk_score": round(score, 4),
                })
        except Exception:
            continue

    result = {
        "points": points,
        "model": "climate-risk-v1",
        "generated_at": datetime.utcnow().isoformat(),
    }

    try:
        r = get_redis()
        await r.setex("heatmap:accident-risk", 3600, json.dumps(result))
    except Exception:
        pass

    return result


@router.get("/accident-risk/train", summary="Entrenar modelo de riesgo (disparo manual)")
async def train_risk_model(
    db: AsyncSession = Depends(get_db),
):
    from app.ml.feature_pipeline import build_training_features
    from app.ml.risk_model import SimpleRiskModel

    features = await build_training_features(db, limit=500, offset=0)
    model = SimpleRiskModel.get_instance()
    weights = model.train(features)

    return {
        "status": "ok",
        "samples": len(features),
        "weights": weights,
    }
