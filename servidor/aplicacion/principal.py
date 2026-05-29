"""Punto de entrada FastAPI — sirve API + cliente tppmaps."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from aplicacion.api.v1.enrutador import enrutador_api
from aplicacion.nucleo.configuracion import ajustes
from aplicacion.nucleo.base_datos import estado_base_datos

CLIENTE_DIR = Path(__file__).resolve().parents[2] / "cliente"

app = FastAPI(
    title=ajustes.nombre_app,
    description="API MoviMed — Medellín (rutas, SIATA, telemetría, reportes)",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

origenes = ajustes.origenes_cors.split(",") if isinstance(ajustes.origenes_cors, str) else ajustes.origenes_cors

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enrutador_api, prefix=ajustes.prefijo_api_v1)


@app.get("/health")
async def salud():
    return {"status": "ok", "servicio": "movimed-api"}


if CLIENTE_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(CLIENTE_DIR), html=True), name="cliente")
