import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.websocket.ws_router import router as ws_router
from app.core.config import settings
from app.db.database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación: verifica la BD al arrancar."""
    logger.info("🚀 Iniciando MoviMed API...")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Conexión a PostgreSQL/PostGIS establecida correctamente.")
    except Exception as e:
        logger.error(f"❌ No se pudo conectar a la base de datos: {e}")
        raise

    yield  # La app corre aquí

    logger.info("🛑 Cerrando MoviMed API — liberando conexiones a la BD...")
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "**MoviMed API** — Plataforma unificada de movilidad inteligente para Medellín.\n\n"
        "Gestiona telemetría geoespacial en tiempo real, vehículos, alertas y analítica de tráfico."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "🔐 Autenticación", "description": "Registro, login y gestión de sesión JWT."},
        {"name": "👤 Usuarios", "description": "CRUD de usuarios y gestión de roles."},
        {"name": "🚗 Vehículos", "description": "Registro y estado de la flota."},
        {"name": "📡 Telemetría", "description": "Ingesta y consulta de datos GPS + PostGIS."},
        {"name": "🔔 Alertas", "description": "Alertas automáticas y manuales del sistema."},
        {"name": "📊 Analítica", "description": "Métricas, heatmaps y estadísticas de flota."},
        {"name": "🔴 Tiempo Real", "description": "WebSockets para telemetría en vivo."},
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

# Router WebSocket (sin prefijo /api/v1)
app.include_router(ws_router, prefix="/ws", tags=["🔴 Tiempo Real"])

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

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
