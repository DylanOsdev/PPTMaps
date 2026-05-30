from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    users,
    reports,
    routes,
    accident_zones,
    flood_hazards,
    vehicles,
    telemetry,
)

api_router = APIRouter()

api_router.include_router(auth.router,    prefix="/auth",    tags=["🔐 Autenticación"])
api_router.include_router(users.router,   prefix="/users",   tags=["👤 Usuarios"])
api_router.include_router(reports.router, prefix="/reports", tags=["📍 Reportes"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["🚑 Vehículos"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["📡 Telemetría"])
api_router.include_router(accident_zones.router, prefix="/accident-zones", tags=["🚗 Zonas de Accidentalidad"])
api_router.include_router(flood_hazards.router,  prefix="/flood-hazards",  tags=["🌊 Riesgos de Inundación"])
api_router.include_router(routes.router,  prefix="/routes",  tags=["🗺️ Rutas"])
