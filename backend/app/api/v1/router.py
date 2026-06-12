from fastapi import APIRouter
from app.api.v1.endpoints import (
    reports,
    accident_zones,
    flood_hazards,
    public,
    chatbot,
    air_quality,
)

api_router = APIRouter()

api_router.include_router(reports.router, prefix="/reports", tags=["📍 Reportes Ciudadanos"])
api_router.include_router(public.router, prefix="/public", tags=["🌐 Público"])
api_router.include_router(air_quality.router, prefix="/public/air-quality", tags=["🌬️ Calidad del Aire"])
api_router.include_router(chatbot.router, prefix="/chatbot", tags=["🤖 Chatbot IA"])
api_router.include_router(accident_zones.router, prefix="/accident-zones", tags=["🚗 Zonas de Accidentalidad"])
api_router.include_router(flood_hazards.router,  prefix="/flood-hazards",  tags=["🌊 Riesgos de Inundación"])
