from fastapi import APIRouter

enrutador = APIRouter()


@enrutador.get("/mapa-predictivo")
async def mapa_predictivo():
    return {
        "puntos": [
            {"lat": 6.255, "lng": -75.595, "peso": 0.8},
            {"lat": 6.24, "lng": -75.588, "peso": 0.6},
        ],
        "features": [
            {"lat": 6.255, "lng": -75.595, "weight": 0.8},
        ],
    }


@enrutador.get("/clusters")
async def clusters_dbscan():
    return {
        "clusters": [
            {"lat": 6.255, "lng": -75.595, "peso": 0.9},
            {"lat": 6.24, "lng": -75.588, "peso": 0.7},
            {"lat": 6.208, "lng": -75.565, "peso": 0.85},
        ],
    }
