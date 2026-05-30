import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

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

    # Encola el sync de clima para que el mapa no quede vacío hasta el próximo beat.
    enqueue_startup_syncs()

    yield  # La app corre aquí

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
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    _index = _frontend / "index.html"
    _api_prefixes = ("api/", "ws/", "health", "docs", "redoc", "openapi.json")

    app.mount("/assets", StaticFiles(directory=str(_frontend / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """Sirve archivos del dist si existen; si no, index.html (deep-links SPA).
        Excluye prefijos de API/infra para no enmascarar sus 404."""
        if full_path.startswith(_api_prefixes):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = _frontend / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_index))
else:
    logger.warning("Frontend no montado: falta frontend/dist. Corré 'npm run build' en frontend/.")
