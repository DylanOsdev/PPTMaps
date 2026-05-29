from fastapi import APIRouter

enrutador = APIRouter()


@enrutador.get("/lluvia")
async def prediccion_lluvia():
    return {
        "mensaje": "Se prevé fuerte lluvia en 45 min. Salir YA por la 80 para evitar inundación en Bulerías.",
        "minutos": 45,
        "riesgo_pct": 78,
    }
