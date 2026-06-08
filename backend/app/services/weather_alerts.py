"""Servicio de generación automática de alertas meteorológicas basadas en weather_snapshots."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.weather import WeatherSnapshot
from app.models.alert import Alert, AlertSeverity
from app.models.flood_hazard import FloodHazard, FloodStatus


async def generate_weather_alerts(db: AsyncSession) -> int:
    """Analiza weather snapshots actuales y genera alertas meteorológicas.
    
    Retorna el número de alertas creadas.
    """
    alerts_created = 0
    now = datetime.now(timezone.utc)
    
    # Resolver alertas antiguas de tipo weather (>1 hora)
    one_hour_ago = now - timedelta(hours=1)
    await db.execute(
        select(Alert)
        .where(
            and_(
                Alert.type == "weather",
                Alert.is_resolved == False,
                Alert.created_at < one_hour_ago
            )
        )
        .execution_options(synchronize_session=False)
    )
    existing = (await db.execute(
        select(Alert)
        .where(Alert.type == "weather", Alert.is_resolved == False)
    )).scalars().all()
    
    for alert in existing:
        alert.is_resolved = True
        alert.resolved_at = now
    
    # Obtener weather snapshots recientes (últimos 20 min)
    recent_cutoff = now - timedelta(minutes=20)
    weather_rows = (await db.execute(
        select(WeatherSnapshot)
        .where(WeatherSnapshot.recorded_at >= recent_cutoff)
        .order_by(WeatherSnapshot.recorded_at.desc())
    )).scalars().all()
    
    if not weather_rows:
        await db.commit()
        return 0
    
    # ALERTA 1: Lluvia inminente (≥90%)
    high_rain_zones = [w for w in weather_rows if w.precipitation_prob_2h and w.precipitation_prob_2h >= 90]
    if high_rain_zones:
        zones_str = ", ".join([w.location_name for w in high_rain_zones])
        alert = Alert(
            type="weather",
            severity=AlertSeverity.CRITICAL,
            message=f"⛈️ Lluvia inminente en {zones_str} (probabilidad ≥90%)",
            is_resolved=False,
        )
        db.add(alert)
        alerts_created += 1
    
    # ALERTA 2: Riesgo de lluvia (70-89%)
    medium_rain_zones = [w for w in weather_rows if w.precipitation_prob_2h and 70 <= w.precipitation_prob_2h < 90]
    if medium_rain_zones:
        zones_str = ", ".join([w.location_name for w in medium_rain_zones])
        alert = Alert(
            type="weather",
            severity=AlertSeverity.WARNING,
            message=f"🌧️ Riesgo de lluvia en {zones_str} ({medium_rain_zones[0].precipitation_prob_2h}%)",
            is_resolved=False,
        )
        db.add(alert)
        alerts_created += 1
    
    # ALERTA 3: Temperatura extrema (>32°C o <12°C)
    hot_zones = [w for w in weather_rows if w.temperature_c and w.temperature_c > 32]
    if hot_zones:
        zones_str = ", ".join([f"{w.location_name} ({w.temperature_c}°C)" for w in hot_zones])
        alert = Alert(
            type="weather",
            severity=AlertSeverity.WARNING,
            message=f"🔥 Temperatura extrema: {zones_str}",
            is_resolved=False,
        )
        db.add(alert)
        alerts_created += 1
    
    cold_zones = [w for w in weather_rows if w.temperature_c and w.temperature_c < 12]
    if cold_zones:
        zones_str = ", ".join([f"{w.location_name} ({w.temperature_c}°C)" for w in cold_zones])
        alert = Alert(
            type="weather",
            severity=AlertSeverity.INFO,
            message=f"❄️ Temperatura baja: {zones_str}",
            is_resolved=False,
        )
        db.add(alert)
        alerts_created += 1
    
    # ALERTA 4: Múltiples deprimidos en riesgo (≥3 en vigilancia/inundados)
    flood_count = (await db.execute(
        select(func.count())
        .select_from(FloodHazard)
        .where(FloodHazard.status.in_([FloodStatus.watch, FloodStatus.flooded]))
    )).scalar_one()
    
    if flood_count >= 3:
        alert = Alert(
            type="weather",
            severity=AlertSeverity.CRITICAL,
            message=f"🚨 {flood_count} deprimidos en riesgo de inundación. Evite zonas bajas.",
            is_resolved=False,
        )
        db.add(alert)
        alerts_created += 1
    
    await db.commit()
    return alerts_created
