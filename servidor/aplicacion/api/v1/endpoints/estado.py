from fastapi import APIRouter

from aplicacion.nucleo.base_datos import estado_base_datos

enrutador = APIRouter()


@enrutador.get("/estado")
async def estado_sistema():
    bd = estado_base_datos()
    return {
        "api": "activa",
        "base_datos": bd,
        "redis": "pendiente",
        "comunas_medellin": 16,
        "municipios_valle": 9,
        "region": "Valle de Aburrá",
    }
