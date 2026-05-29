from fastapi import APIRouter, Query

enrutador = APIRouter()


@enrutador.get("")
async def ruta_segura(dest: str = Query(..., description="Destino o comuna")):
    return {
        "destino": dest,
        "coordenadas": [
            [6.251, -75.59],
            [6.248, -75.585],
            [6.245, -75.578],
            [6.238, -75.568],
        ],
        "riesgo_lluvia_pct": 0,
        "puntos_evitados": 3,
    }
