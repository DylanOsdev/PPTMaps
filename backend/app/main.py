import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.startup import (
    seed_initial_data,
    seed_zones_if_empty,
    start_background_tasks,
    stop_background_tasks,
    verify_db_connection,
)
from app.db.database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación."""
    logger.info("Iniciando PPTMaps API...")

    try:
        await verify_db_connection()
    except Exception as e:
        logger.error("No se pudo conectar a la base de datos: %s", e)
        raise

    await seed_zones_if_empty()
    await seed_initial_data()

    app_state: dict = {}
    await start_background_tasks(app_state)

    yield

    await stop_background_tasks(app_state)

    logger.info("Cerrando PPTMaps API — liberando conexiones a la BD...")
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
from fastapi.responses import FileResponse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def resolve_frontend_dir(root: Path):
    """Devuelve el build compilado (frontend/dist) solo si existe su index.html; si no, None."""
    dist = root / "frontend" / "dist"
    return dist if (dist / "index.html").is_file() else None


_frontend = resolve_frontend_dir(PROJECT_ROOT)
if _frontend is not None:
    # Montar archivos estáticos primero
    app.mount("/assets", StaticFiles(directory=str(_frontend / "assets")), name="assets")
    app.mount("/static", StaticFiles(directory=str(_frontend / "static")), name="static")
    
    # Catch-all para React Router: SOLO rutas que no sean /api, /docs, /health, /ws
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Sirve el SPA de React para cualquier ruta que no sea API/docs/health/ws."""
        # Si la ruta empieza con prefijos reservados, NO capturar (dejar que FastAPI maneje 404)
        if full_path.startswith(("api/", "docs", "redoc", "health", "ws/", "openapi.json")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        
        # Si es un archivo estático existente, servirlo directamente
        file_path = _frontend / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        # Todas las demás rutas sirven el index.html (React Router)
        return FileResponse(_frontend / "index.html")
else:
    logger.warning("Frontend no montado: falta frontend/dist. Corré 'npm run build' en frontend/.")
