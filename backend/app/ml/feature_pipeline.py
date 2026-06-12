import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class RiskFeatures:
    lat: float
    lng: float
    hour: int
    month: int
    dayofweek: int
    is_weekend: int
    precipitation_mm: float
    temperature_c: Optional[float]
    humidity: Optional[float]
    accident_density_1km: float
    reports_last_24h: int
    weather_event_nearby: int
    severity: Optional[int] = None


@dataclass
class RiskPrediction:
    lat: float
    lng: float
    comuna: Optional[str]
    risk_score: float
    timestamp: datetime


TRAINING_WINDOW_HOURS = 1
NEARBY_RADIUS_M = 1000
REPORTS_WINDOW_HOURS = 24
EVENT_RADIUS_M = 2000


async def build_training_features(
    db: AsyncSession,
    limit: int = 50000,
    offset: int = 0,
) -> List[RiskFeatures]:
    rows = await db.execute(
        text("""
            SELECT
                a.id,
                ST_Y(a.geom::geometry) AS lat,
                ST_X(a.geom::geometry) AS lng,
                EXTRACT(HOUR FROM a.incident_date::timestamp)::int AS hour,
                EXTRACT(MONTH FROM a.incident_date)::int AS month,
                EXTRACT(DOW FROM a.incident_date)::int AS dayofweek,
                CASE WHEN EXTRACT(DOW FROM a.incident_date) IN (0, 6) THEN 1 ELSE 0 END AS is_weekend,
                COALESCE(h.precipitation_mm, 0) AS precipitation_mm,
                h.temperature_c,
                h.humidity,
                CASE WHEN a.severity = 'MUERTO' THEN 5
                     WHEN a.severity = 'HERIDO' THEN 3
                     ELSE 1 END AS severity
            FROM accident_incidents a
            LEFT JOIN LATERAL (
                SELECT precipitation_mm, temperature_c, humidity
                FROM historical_weather_medellin hw
                WHERE hw.timestamp BETWEEN a.incident_date - INTERVAL '1 day' AND a.incident_date + INTERVAL '1 day'
                ORDER BY ABS(EXTRACT(EPOCH FROM (hw.timestamp - a.incident_date::timestamp)))
                LIMIT 1
            ) h ON true
            WHERE a.incident_date IS NOT NULL AND a.geom IS NOT NULL
            ORDER BY a.incident_date
            LIMIT :lim OFFSET :off
        """),
        {"lim": limit, "off": offset},
    )
    base = []
    for row in rows:
        lat, lng = row.lat, row.lng
        base.append(RiskFeatures(
            lat=lat,
            lng=lng,
            hour=int(row.hour),
            month=int(row.month),
            dayofweek=int(row.dayofweek),
            is_weekend=int(row.is_weekend),
            precipitation_mm=float(row.precipitation_mm or 0),
            temperature_c=float(row.temperature_c) if row.temperature_c is not None else None,
            humidity=float(row.humidity) if row.humidity is not None else None,
            accident_density_1km=0.0,
            reports_last_24h=0,
            weather_event_nearby=0,
            severity=int(row.severity),
        ))

    return base


async def _count_nearby_accidents(db: AsyncSession, lat: float, lng: float) -> int:
    row = await db.execute(
        text("""
            SELECT COUNT(*) AS cnt
            FROM accident_incidents
            WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
        """),
        {"lat": lat, "lng": lng, "radius": NEARBY_RADIUS_M},
    )
    return row.scalar_one() or 0


async def _count_recent_reports(db: AsyncSession, lat: float, lng: float) -> int:
    cutoff = datetime.utcnow() - timedelta(hours=REPORTS_WINDOW_HOURS)
    row = await db.execute(
        text("""
            SELECT COUNT(*) AS cnt
            FROM reports
            WHERE created_at >= :cutoff
              AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
        """),
        {"lat": lat, "lng": lng, "radius": NEARBY_RADIUS_M, "cutoff": cutoff},
    )
    return row.scalar_one() or 0


async def _count_nearby_events(db: AsyncSession, lat: float, lng: float) -> int:
    cutoff = datetime.utcnow() - timedelta(hours=6)
    row = await db.execute(
        text("""
            SELECT COUNT(*) AS cnt
            FROM weather_events
            WHERE timestamp >= :cutoff
              AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
        """),
        {"lat": lat, "lng": lng, "radius": EVENT_RADIUS_M, "cutoff": cutoff},
    )
    return row.scalar_one() or 0


async def build_inference_features(
    db: AsyncSession,
    lat: float,
    lng: float,
) -> RiskFeatures:
    now = datetime.utcnow()
    weather_task = db.execute(
        text("""
            SELECT rain_mm, temperature_c, humidity
            FROM weather_snapshots
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
            LIMIT 1
        """),
        {"lat": lat, "lng": lng},
    )
    results = await asyncio.gather(
        weather_task,
        _count_nearby_accidents(db, lat, lng),
        _count_recent_reports(db, lat, lng),
        _count_nearby_events(db, lat, lng),
    )
    w = results[0].first()
    return RiskFeatures(
        lat=lat,
        lng=lng,
        hour=now.hour,
        month=now.month,
        dayofweek=now.weekday(),
        is_weekend=1 if now.weekday() >= 5 else 0,
        precipitation_mm=float(w.rain_mm) if w and w.rain_mm else 0.0,
        temperature_c=float(w.temperature_c) if w and w.temperature_c else None,
        humidity=float(w.humidity) if w and w.humidity else None,
        accident_density_1km=results[1],
        reports_last_24h=results[2],
        weather_event_nearby=results[3],
    )
