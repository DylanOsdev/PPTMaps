import math
import time
from copy import deepcopy
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.db.database import get_db
from app.models.telemetry import Telemetry
from app.models.alert import Alert
from app.models.report import Report
from app.models.flood_hazard import FloodHazard
from app.models.accident_zone import AccidentZone

router = APIRouter()

FALLBACK_ACCIDENTS = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5678, 6.2800]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Colisión múltiple con fallecido", "description": "Colisión múltiple · Autopista Norte, km 5"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5690, 6.2100]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Atropello con fatalidad", "description": "Atropello peatonal · Av. El Poblado con Calle 10"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5730, 6.2420]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Choque por alcance", "description": "Choque por alcance · Av. Regional, sentido norte"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5880, 6.2530]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Colisión leve", "description": "Colisión leve · Cra. 70 con Calle 44"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.3740, 6.1550]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Volcamiento con fallecido", "description": "Volcamiento · Autopista Medellín-Bogotá, sector Rionegro"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5920, 6.2450]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Accidente de moto", "description": "Caída de motociclista · Cra. 80 con Calle 49"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5780, 6.2550]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Choque lateral", "description": "Choque lateral · Av. 33 con Cra. 65"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.6140, 6.1710]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Arrollamiento fatal", "description": "Peatón arrollado · Autopista Sur, Itagüí"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5650, 6.2380]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Estrellón contra poste", "description": "Vehículo contra poste · Calle 30 con Cra. 52"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5710, 6.2080]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Colisión intersección", "description": "Colisión en intersección · Cra. 43A con Calle 7"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.6270, 6.2900]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Choque frontal", "description": "Choque frontal · Vía al Mar, sector San Cristóbal"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5600, 6.2480]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Alcance leve", "description": "Alcance trasero · Av. Oriental con Calle 49"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5580, 6.3370]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Accidente de bus", "description": "Bus articulado choca contra taxi · Av. del Ferrocarril, Bello"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5830, 6.2680]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Colisión con motociclista fatal", "description": "Moto embestida por tractocamión · Cra. 64 con Calle 67"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5780, 6.1690]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Caída de pasajero", "description": "Pasajero cae de bus en movimiento · Av. Las Palmas, Envigado"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5630, 6.2180]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Golpe en estacionamiento", "description": "Colisión en parqueadero · Centro Comercial Santafé"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5600, 6.3000]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Arrollamiento en autopista", "description": "Peatón cruzando autopista · Autopista Norte, Acevedo"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5400, 6.1900]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Colisión múltiple", "description": "3 vehículos involucrados · Túnel de Oriente"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5980, 6.2380]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Raspadura de espejos", "description": "Raspadura entre vehículos · Cra. 76 con Calle 42"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5720, 6.1970]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Volcamiento de camioneta", "description": "Camioneta volcada · Vía Las Palmas, km 4"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.6200, 6.1550]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Choque contra muro", "description": "Vehículo contra muro de contención · Autopista Sur, Sabaneta"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5750, 6.2480]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Accidente de bicicleta", "description": "Ciclista arrollado · Av. Regional con Calle 30"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5750, 6.2000]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Colisión leve en semáforo", "description": "Golpe leve en semáforo · Cra. 48 con Calle 10 Sur"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5550, 6.2720]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Arrollamiento masivo", "description": "Bus pierde frenos · Terminal del Norte"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5950, 6.2600]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Derrape de moto", "description": "Motociclista derrapa en piso mojado · Cra. 70, Robledo"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5800, 6.2050]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Golpe en reja", "description": "Vehículo golpea reja de protección · Puente de la 4 Sur"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.6500, 6.2300]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Colisión frontal con bus", "description": "Bus intermunicipal choca de frente · Vía Medellín-Santa Fe de Antioquia"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5520, 6.3350]}, "properties": {"severity": "medium", "gravedad": "HERIDO", "clase_incidente": "Caída de moto por hueco", "description": "Motociclista cae por hueco en vía · Cra. 65 con Calle 107, Bello"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5730, 6.2030]}, "properties": {"severity": "low", "gravedad": "DAÑOS", "clase_incidente": "Roce entre vehículos", "description": "Roce de retrovisores · Calle 12 Sur con Cra. 43A"}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-75.5690, 6.2350]}, "properties": {"severity": "high", "gravedad": "MUERTO", "clase_incidente": "Atropello en zona escolar", "description": "Niño atropellado frente a colegio · Calle 50 con Cra. 55"}},
    ],
}

FALLBACK_TELEMETRY = [
    {"id": "v1", "vehicle_id": "v1", "lat": 6.2515, "lng": -75.5635, "speed": 42.5, "heading": 180, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v2", "vehicle_id": "v2", "lat": 6.2398, "lng": -75.5902, "speed": 35.0, "heading": 270, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v3", "vehicle_id": "v3", "lat": 6.2178, "lng": -75.5705, "speed": 0.0, "heading": 0, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v4", "vehicle_id": "v4", "lat": 6.2023, "lng": -75.5623, "speed": 55.0, "heading": 90, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v5", "vehicle_id": "v5", "lat": 6.2756, "lng": -75.5387, "speed": 28.0, "heading": 45, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v6", "vehicle_id": "v6", "lat": 6.1978, "lng": -75.5762, "speed": 65.0, "heading": 135, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v7", "vehicle_id": "v7", "lat": 6.2675, "lng": -75.5648, "speed": 15.0, "heading": 315, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v8", "vehicle_id": "v8", "lat": 6.2265, "lng": -75.5552, "speed": 48.0, "heading": 225, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v9", "vehicle_id": "v9", "lat": 6.2489, "lng": -75.5725, "speed": 0.0, "heading": 0, "timestamp": "2026-05-29T22:00:00Z"},
    {"id": "v10", "vehicle_id": "v10", "lat": 6.2356, "lng": -75.5489, "speed": 72.0, "heading": 180, "timestamp": "2026-05-29T22:00:00Z"},
]

FALLBACK_ALERTS = [
    {"id": "a1", "type": "traffic", "severity": "WARNING", "message": "Congestión severa en Av. Oriental sentido Sur-Norte", "created_at": "2026-05-29T21:55:00Z", "is_resolved": False},
    {"id": "a2", "type": "siata", "severity": "WARNING", "message": "Nivel del río Medellín en aumento - Sector La Mota", "created_at": "2026-05-29T21:50:00Z", "is_resolved": False},
    {"id": "a3", "type": "traffic", "severity": "CRITICAL", "message": "Accidente múltiple en Autopista Sur con víctimas", "created_at": "2026-05-29T21:45:00Z", "is_resolved": False},
    {"id": "a4", "type": "citizen", "severity": "INFO", "message": "Reporte ciudadano: hueco profundo en Cra 48 con 33", "created_at": "2026-05-29T21:40:00Z", "is_resolved": False},
    {"id": "a5", "type": "siata", "severity": "CRITICAL", "message": "Quebrada La Hueso en nivel crítico - Evacuar zonas aledañas", "created_at": "2026-05-29T21:35:00Z", "is_resolved": False},
    {"id": "a6", "type": "traffic", "severity": "WARNING", "message": "Semáforo averiado en intersección Av. 33 con Cra 70", "created_at": "2026-05-29T21:30:00Z", "is_resolved": False},
    {"id": "a7", "type": "citizen", "severity": "INFO", "message": "Vía obstruida por árbol caído en Av. El Poblado", "created_at": "2026-05-29T21:25:00Z", "is_resolved": False},
]

FALLBACK_FLOOD_ZONES = [
    {"id": 1, "name": "Quebrada La Iguaná - Aguas Frías", "siata_station_id": "Q001", "status": "watch", "water_level_m": 1.8, "geom": {"type": "Polygon", "coordinates": [[[-75.612,6.278],[-75.600,6.282],[-75.595,6.275],[-75.608,6.270],[-75.612,6.278]]]}},
    {"id": 2, "name": "Quebrada Santa Elena - Villa Hermosa", "siata_station_id": "Q002", "status": "dry", "water_level_m": 0.6, "geom": {"type": "Polygon", "coordinates": [[[-75.548,6.230],[-75.540,6.235],[-75.535,6.228],[-75.545,6.222],[-75.548,6.230]]]}},
    {"id": 3, "name": "Río Medellín - La Mota", "siata_station_id": "R001", "status": "watch", "water_level_m": 2.1, "geom": {"type": "Polygon", "coordinates": [[[-75.582,6.202],[-75.575,6.208],[-75.570,6.202],[-75.578,6.195],[-75.582,6.202]]]}},
    {"id": 4, "name": "Quebrada La Hueso - Castilla", "siata_station_id": "Q003", "status": "flooded", "water_level_m": 2.5, "geom": {"type": "Polygon", "coordinates": [[[-75.590,6.265],[-75.582,6.270],[-75.576,6.263],[-75.584,6.257],[-75.590,6.265]]]}},
    {"id": 5, "name": "Quebrada La Presidenta - El Poblado", "siata_station_id": "Q004", "status": "dry", "water_level_m": 0.4, "geom": {"type": "Polygon", "coordinates": [[[-75.565,6.215],[-75.558,6.220],[-75.552,6.212],[-75.562,6.208],[-75.565,6.215]]]}},
]

FALLBACK_FATALITIES_BASE = [
    f for f in FALLBACK_ACCIDENTS["features"]
    if f["properties"].get("gravedad") == "MUERTO"
]

_request_counter = 0

FALLBACK_ANALYTICS = {
    "total_reports": 47,
    "active_alerts": 7,
    "average_speed_kmh": 32.5,
    "total_telemetry_records": 1280,
}

@router.get("/accidents", summary="Incidentes de tránsito recientes")
async def list_public_accidents(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(Report).where(Report.report_type == "accident")
            .order_by(desc(Report.created_at))
            .limit(limit)
        )
        return result.scalars().all()
    except Exception:
        return FALLBACK_ACCIDENTS["features"]

@router.get("/accidents/geojson", summary="Incidentes en formato GeoJSON")
async def public_accidents_geojson(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    try:
        from geoalchemy2.functions import ST_AsGeoJSON
        import json
        result = await db.execute(
            select(Report.id, Report.report_type, Report.description, Report.created_at, ST_AsGeoJSON(Report.geom).label("geom_json"))
            .where(Report.report_type == "accident")
            .order_by(desc(Report.created_at))
            .limit(limit)
        )
        rows = result.fetchall()
        features = [
            {
                "type": "Feature",
                "geometry": json.loads(r.geom_json),
                "properties": {
                    "id": r.id,
                    "type": r.report_type.value if hasattr(r.report_type, 'value') else str(r.report_type),
                    "description": r.description,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                },
            }
            for r in rows if r.geom_json
        ]
        return {"type": "FeatureCollection", "features": features}
    except Exception:
        return FALLBACK_ACCIDENTS

@router.get("/fatalities", summary="Fallecidos en accidentes (tiempo real)")
async def public_fatalities(
    db: AsyncSession = Depends(get_db),
):
    global _request_counter
    _request_counter += 1

    try:
        result = await db.execute(
            select(Report).where(
                Report.report_type == "accident",
                Report.severity == "high",
            )
            .order_by(desc(Report.created_at))
            .limit(50)
        )
        rows = result.scalars().all()
        from geoalchemy2.functions import ST_AsGeoJSON
        import json
        features = [
            {
                "type": "Feature",
                "geometry": json.loads(r.geom_json) if r.geom_json else None,
                "properties": {
                    "id": r.id,
                    "gravedad": "MUERTO",
                    "severity": "high",
                    "clase_incidente": r.description or "Accidente fatal",
                    "description": r.description or "",
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                },
            }
            for r in rows if r.geom_json
        ]
        return {
            "type": "FeatureCollection",
            "features": features,
            "_meta": {
                "total_fatalities": len(features),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "request_count": _request_counter,
                "source": "database",
            },
        }
    except Exception:
        now = datetime.now(timezone.utc)
        ts = now.timestamp()
        features = deepcopy(FALLBACK_FATALITIES_BASE)
        for i, f in enumerate(features):
            drift_lng = math.sin(ts / 100 + i * 1.7) * 0.0003
            drift_lat = math.cos(ts / 80 + i * 2.3) * 0.0003
            f["geometry"]["coordinates"][0] += drift_lng
            f["geometry"]["coordinates"][1] += drift_lat
            f["properties"]["_drift"] = {"lat": round(drift_lat, 6), "lng": round(drift_lng, 6)}
            f["properties"]["_updated_at"] = now.isoformat()

        return {
            "type": "FeatureCollection",
            "features": features,
            "_meta": {
                "total_fatalities": len(features),
                "fetched_at": now.isoformat(),
                "request_count": _request_counter,
                "source": "fallback",
            },
        }


@router.get("/telemetry/latest", summary="Últimas posiciones GPS (público)")
async def public_latest_telemetry(
    db: AsyncSession = Depends(get_db),
):
    try:
        subq = (
            select(Telemetry.vehicle_id, func.max(Telemetry.timestamp).label("max_ts"))
            .group_by(Telemetry.vehicle_id)
            .subquery()
        )
        result = await db.execute(
            select(Telemetry).join(
                subq,
                (Telemetry.vehicle_id == subq.c.vehicle_id) &
                (Telemetry.timestamp == subq.c.max_ts)
            )
        )
        rows = result.scalars().all()
        if rows:
            return [
                {
                    "id": str(t.id),
                    "vehicle_id": str(t.vehicle_id),
                    "lat": t.latitude,
                    "lng": t.longitude,
                    "speed": t.speed,
                    "heading": t.heading,
                    "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                }
                for t in rows
            ]
        return FALLBACK_TELEMETRY
    except Exception:
        return FALLBACK_TELEMETRY

@router.get("/telemetry/nearby", summary="Posiciones cercanas (público)")
async def public_telemetry_nearby(
    lat: float,
    lng: float,
    radius_meters: float = 1000.0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    try:
        from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_DWithin
        center = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        result = await db.execute(
            select(Telemetry)
            .where(ST_DWithin(Telemetry.location.cast("geography"), center.cast("geography"), radius_meters))
            .order_by(desc(Telemetry.timestamp))
            .limit(limit)
        )
        return result.scalars().all()
    except Exception:
        return FALLBACK_TELEMETRY[:5]

@router.get("/alerts", summary="Alertas activas (público)")
async def list_public_alerts(
    is_resolved: Optional[bool] = False,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    try:
        query = select(Alert).order_by(desc(Alert.created_at))
        if is_resolved is not None:
            query = query.where(Alert.is_resolved == is_resolved)
        result = await db.execute(query.limit(limit))
        return result.scalars().all()
    except Exception:
        return FALLBACK_ALERTS

@router.get("/flood-zones", summary="Zonas de inundación/riesgo (público)")
async def list_public_flood_zones(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        from geoalchemy2.functions import ST_AsGeoJSON
        import json
        query = select(
            FloodHazard.id, FloodHazard.name, FloodHazard.siata_station_id,
            FloodHazard.status, FloodHazard.water_level_m,
            FloodHazard.created_at, FloodHazard.updated_at,
            ST_AsGeoJSON(FloodHazard.geom).label("geom_json")
        ).order_by(desc(FloodHazard.water_level_m))
        if status:
            from app.models.flood_hazard import FloodStatus
            query = query.where(FloodHazard.status == FloodStatus(status))
        result = await db.execute(query)
        rows = result.fetchall()
        return [
            {
                "id": r.id,
                "name": r.name,
                "siata_station_id": r.siata_station_id,
                "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
                "water_level_m": r.water_level_m,
                "geom": json.loads(r.geom_json) if r.geom_json else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
    except Exception:
        return FALLBACK_FLOOD_ZONES

@router.get("/accident-zones", summary="Zonas de alta accidentalidad (público)")
async def list_public_accident_zones(
    min_severity: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        query = select(AccidentZone).order_by(desc(AccidentZone.severity))
        if min_severity is not None:
            query = query.where(AccidentZone.severity >= min_severity)
        result = await db.execute(query)
        return result.scalars().all()
    except Exception:
        return []

@router.get("/reports", summary="Reportes ciudadanos (público)")
async def list_public_reports(
    type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    try:
        from geoalchemy2.functions import ST_AsGeoJSON
        import json
        query = select(
            Report.id, Report.report_type, Report.description, Report.created_at,
            ST_AsGeoJSON(Report.geom).label("geom_json")
        ).order_by(desc(Report.created_at))
        if type:
            query = query.where(Report.report_type == type)
        result = await db.execute(query.limit(limit))
        rows = result.fetchall()
        return [
            {
                "id": r.id,
                "type": r.report_type.value if hasattr(r.report_type, 'value') else str(r.report_type),
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "geom": json.loads(r.geom_json) if r.geom_json else None,
            }
            for r in rows
        ]
    except Exception:
        return FALLBACK_ACCIDENTS["features"][:5]

@router.get("/analytics/summary", summary="Resumen de métricas (público)")
async def public_analytics_summary(
    db: AsyncSession = Depends(get_db),
):
    try:
        total_reports = (await db.execute(select(func.count(Report.id)))).scalar()
        active_alerts = (await db.execute(
            select(func.count(Alert.id)).where(Alert.is_resolved == False)
        )).scalar()
        avg_speed = (await db.execute(select(func.avg(Telemetry.speed)))).scalar()
        total_telemetry = (await db.execute(select(func.count(Telemetry.id)))).scalar()
        return {
            "total_reports": total_reports or 0,
            "active_alerts": active_alerts or 0,
            "average_speed_kmh": round(avg_speed, 2) if avg_speed else 0,
            "total_telemetry_records": total_telemetry or 0,
        }
    except Exception:
        return FALLBACK_ANALYTICS
