from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, vehicles, telemetry, alerts, analytics

api_router = APIRouter()

api_router.include_router(auth.router,      prefix="/auth",      tags=["🔐 Autenticación"])
api_router.include_router(users.router,     prefix="/users",     tags=["👤 Usuarios"])
api_router.include_router(vehicles.router,  prefix="/vehicles",  tags=["🚗 Vehículos"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["📡 Telemetría"])
api_router.include_router(alerts.router,    prefix="/alerts",    tags=["🔔 Alertas"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["📊 Analítica"])
