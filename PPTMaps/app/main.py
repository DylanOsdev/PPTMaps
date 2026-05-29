import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.websocket.ws_router import router as ws_router
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "**MoviMed API** — Plataforma unificada de movilidad inteligente para Medellín.\n\n"
        "Gestiona telemetría geoespacial en tiempo real, vehículos, alertas y analítica de tráfico."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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

@app.get("/", tags=["Health"], summary="Estado del servidor")
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online ✅",
        "docs": "/docs",
        "ws_endpoint": "/ws/telemetry",
    }

@app.get("/health", tags=["Health"], summary="Health check")
async def health():
    return {"status": "ok"}
