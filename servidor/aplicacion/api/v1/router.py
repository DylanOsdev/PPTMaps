from fastapi import APIRouter

from app.api.v1.endpoints import health, reports, routes, telemetry

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(routes.router, prefix="/routes", tags=["routes"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
