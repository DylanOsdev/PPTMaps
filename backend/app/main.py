import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.database import engine, async_session_maker
from app.services.zones_seed import seed_zones_on_startup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


def enqueue_startup_syncs() -> None:
    """Encola las sincronizaciones que deben poblar datos sin esperar al beat.

    Evita que el mapa de clima quede vacío hasta el próximo múltiplo de 15 min.
    Es resiliente: si el broker (Redis) está caído, el arranque NO debe fallar.
    """
    from app.tasks.cron_jobs import sync_weather

    try:
        sync_weather.delay()
    except Exception as e:  # broker caído u otro fallo de encolado
        logger.warning(" No se pudo encolar weather.sync al arrancar: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación: verifica la BD al arrancar."""
    logger.info("🚀 Iniciando PPTMaps API...")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Conexión a PostgreSQL/PostGIS establecida correctamente.")
    except Exception as e:
        logger.error(f"❌ No se pudo conectar a la base de datos: {e}")
        raise

    # Siembra de zonas (comunas/municipios) en PostGIS: idempotente y resiliente.
    async with async_session_maker() as db:
        seeded = await seed_zones_on_startup(db, settings.ZONES_JSON_PATH)
    if seeded:
        logger.info("🗺️  Zonas sembradas en PostGIS: %d", seeded)

    # Siembra inicial de datos si la BD está vacía (accidentes + SIATA flood zones + alertas + telemetría).
    # Las actualizaciones posteriores corren vía Celery cada 15 min.
    async with async_session_maker() as db:
        from app.services.ingestion import sync_soda_incidents
        await sync_soda_incidents(db)

        from app.services.siata_sync import SiataSyncService, _create_siata_client
        client = await _create_siata_client()
        await SiataSyncService(client).sync(db)

        # Seed de alertas iniciales para que el panel LIVE ALERTS no arranque vacío.
        from app.crud.crud_alert import get_alerts, create_alert
        from app.schemas.alert import AlertCreate
        from app.models.alert import AlertSeverity

        existing = await get_alerts(db, is_resolved=False, limit=1)
        if not existing:
            seed_alerts = [
                AlertCreate(type="traffic", severity=AlertSeverity.WARNING, message="Congestión vehicular en Av. Oriental - sector Centro"),
                AlertCreate(type="traffic", severity=AlertSeverity.INFO, message="Flujo lento en Autopista Sur sentido Norte-Sur"),
                AlertCreate(type="siata", severity=AlertSeverity.INFO, message="Nivel normal en estaciones SIATA - Valle de Aburrá"),
                AlertCreate(type="siata", severity=AlertSeverity.WARNING, message="Monitoreo activo en quebrada La Iguana"),
            ]
            for alert_in in seed_alerts:
                await create_alert(db, alert_in)
            logger.info("Alertas iniciales sembradas: %d", len(seed_alerts))

        # Seed de telemetría demo (conductores GPS en el mapa)
        from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
        from app.models.vehicle import Vehicle
        from app.models.telemetry import Telemetry
        from datetime import datetime, timezone

        existing_vehicles = (await db.execute(select(Vehicle).limit(1))).scalar_one_or_none()
        if not existing_vehicles:
            DEMO_VEHICLES = [
                {"plate": "AMB-001", "type": "ambulance", "lat": 6.2515, "lng": -75.5635, "speed": 42.0, "heading": 180},
                {"plate": "AMB-002", "type": "ambulance", "lat": 6.2398, "lng": -75.5902, "speed": 35.0, "heading": 270},
                {"plate": "PAT-010", "type": "patrol", "lat": 6.2178, "lng": -75.5705, "speed": 0.0, "heading": 0},
                {"plate": "PAT-011", "type": "patrol", "lat": 6.2756, "lng": -75.5387, "speed": 95.0, "heading": 45},
                {"plate": "BMB-020", "type": "fire", "lat": 6.1978, "lng": -75.5762, "speed": 65.0, "heading": 135},
                {"plate": "BMB-021", "type": "fire", "lat": 6.2489, "lng": -75.5725, "speed": 28.0, "heading": 90},
                {"plate": "PAT-012", "type": "patrol", "lat": 6.2356, "lng": -75.5489, "speed": 55.0, "heading": 315},
                {"plate": "AMB-003", "type": "ambulance", "lat": 6.2265, "lng": -75.5552, "speed": 72.0, "heading": 0},
            ]
            for v in DEMO_VEHICLES:
                vehicle = Vehicle(plate=v["plate"], type=v["type"])
                db.add(vehicle)
                await db.flush()
                telemetry = Telemetry(
                    vehicle_id=vehicle.id,
                    latitude=v["lat"],
                    longitude=v["lng"],
                    speed=v["speed"],
                    heading=v["heading"],
                    location=ST_SetSRID(ST_MakePoint(v["lng"], v["lat"]), 4326),
                    timestamp=datetime.now(timezone.utc),
                )
                db.add(telemetry)
            await db.commit()
            logger.info("Telemetría demo sembrada: %d vehículos", len(DEMO_VEHICLES))

    # Encola el sync de clima para que el mapa no quede vacío hasta el próximo beat.
    enqueue_startup_syncs()

    # Inicia el listener de alertas en Redis pub/sub (reenvía de Celery a WebSocket).
    _alert_listener_task = None

    async def _start_alert_listener():
        from app.db.redis import get_redis
        from app.services.alert_broadcaster import listen_and_broadcast_alerts

        try:
            redis = get_redis()
            await listen_and_broadcast_alerts(redis)
        except asyncio.CancelledError:
            logger.info("🛑 Listener de alertas detenido.")
        except Exception as e:
            logger.warning("No se pudo iniciar listener de alertas: %s", e)

    _alert_listener_task = asyncio.create_task(_start_alert_listener())

    yield  # La app corre aquí

    if _alert_listener_task is not None:
        _alert_listener_task.cancel()
        try:
            await _alert_listener_task
        except asyncio.CancelledError:
            pass

    logger.info("🛑 Cerrando PPTMaps API — liberando conexiones a la BD...")
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "**PPTMaps API** — Plataforma unificada de movilidad inteligente para Medellín.\n\n"
        "Gestiona reportes ciudadanos, zonas de accidentalidad y riesgos de inundación."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "🔐 Autenticación", "description": "Registro, login y gestión de sesión JWT."},
        {"name": "👤 Usuarios", "description": "CRUD de usuarios y gestión de roles."},
        {"name": "📍 Reportes", "description": "Reportes ciudadanos de incidentes viales."},
        {"name": "🗺️ Rutas", "description": "Consulta de rutas optimizadas."},
    ],
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in settings.BACKEND_CORS_ORIGINS] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers REST
app.include_router(api_router, prefix=settings.API_V1_STR)

# WebSocket de telemetría en tiempo real (fuera de /api/v1, contrato frontend /ws/telemetry)
from app.websocket.ws_router import router as ws_router
app.include_router(ws_router, prefix="/ws", tags=["📡 WebSocket"])

@app.get("/health", tags=["Health"], summary="Health check básico")
async def health():
    return {"status": "ok"}


@app.get("/health/db", tags=["Health"], summary="Verifica conexión a PostgreSQL")
async def health_db():
    """Realiza un SELECT 1 contra la BD para confirmar conectividad."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected ✅"}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Database unreachable: {e}")

from fastapi.staticfiles import StaticFiles
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def resolve_frontend_dir(root: Path):
    """Devuelve el build compilado (frontend/dist) solo si existe su index.html; si no, None."""
    dist = root / "frontend" / "dist"
    return dist if (dist / "index.html").is_file() else None


_frontend = resolve_frontend_dir(PROJECT_ROOT)
if _frontend is not None:
    app.mount("/", StaticFiles(directory=str(_frontend), html=True), name="frontend")
else:
    logger.warning("Frontend no montado: falta frontend/dist. Corré 'npm run build' en frontend/.")
