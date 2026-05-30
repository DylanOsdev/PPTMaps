"""Seed de datos demo para validar el stack end-to-end.

Usa el flujo real: crea vehículos vía CRUD, encola telemetría en Redis y la drena
con flush_telemetry (CQRS), siembra alertas, dispara la ingesta SIATA hexagonal y
crea un reporte de accidente. Idempotente-ish: ignora placas duplicadas.
"""
import asyncio
from datetime import datetime, timezone

from app.db.database import async_session_maker
from app.db.redis import get_redis
from app.crud import create_vehicle, crud_alert
from app.crud.crud_report import create_report
from app.schemas.vehicle import VehicleCreate
from app.schemas.alert import AlertCreate
from app.schemas.report import ReportCreate
from app.models.alert import AlertSeverity
from app.models.report import ReportType
from app.services.telemetry import enqueue_telemetry, flush_telemetry
from app.schemas.telemetry import TelemetryCreate
from app.services.siata_sync import SiataSyncService, SiataSeedClient

# Vehículos demo con posiciones por el Valle de Aburrá.
VEHICLES = [
    ("AMB-001", "ambulance", 6.2515, -75.5635, 42.0, 180.0),
    ("AMB-002", "ambulance", 6.2398, -75.5902, 35.0, 270.0),
    ("PAT-010", "patrol", 6.2178, -75.5705, 0.0, 0.0),
    ("PAT-011", "patrol", 6.2756, -75.5387, 95.0, 45.0),   # overspeed
    ("BMB-020", "fire", 6.1978, -75.5762, 65.0, 135.0),
]


async def main():
    redis = get_redis()
    async with async_session_maker() as db:
        # 1) Vehículos + 2) telemetría (CQRS: encolar y drenar)
        pings = []
        for plate, vtype, lat, lng, speed, heading in VEHICLES:
            v = await create_vehicle(db, VehicleCreate(plate=plate, type=vtype))
            pings.append(
                TelemetryCreate(
                    vehicle_id=v.id, lat=lat, lng=lng, speed=speed, heading=heading,
                    timestamp=datetime.now(timezone.utc),
                )
            )
        await enqueue_telemetry(redis, pings)
        flushed = await flush_telemetry(db, redis)

        # 3) Alertas
        await crud_alert.create_alert(db, AlertCreate(type="traffic", severity=AlertSeverity.WARNING, message="Congestión severa en Av. Oriental"))
        await crud_alert.create_alert(db, AlertCreate(type="siata", severity=AlertSeverity.CRITICAL, message="Nivel del río Medellín en aumento - La Mota"))

        # 4) Zonas de inundación (ingesta SIATA hexagonal)
        hazards = await SiataSyncService(SiataSeedClient()).sync(db)

        # 5) Reporte de accidente (para /public/accidents/geojson)
        await create_report(db, ReportCreate(report_type=ReportType.accident, description="Choque múltiple Autopista Sur", latitude=6.2380, longitude=-75.5750))

    await redis.aclose()
    print(f"Seed OK: {len(VEHICLES)} vehículos, {flushed} pings, 2 alertas, {hazards} flood_hazards, 1 accidente")


if __name__ == "__main__":
    asyncio.run(main())
