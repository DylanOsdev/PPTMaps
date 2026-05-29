from fastapi import APIRouter

enrutador = APIRouter()


@enrutador.get("/alertas")
async def alertas_siata():
    return {
        "alertas": [
            {
                "tipo": "siata",
                "hora": "13:38",
                "fuente": "SIATA Medellín",
                "texto": "Deprimidos despejados — Centro y La 80.",
            },
            {
                "tipo": "siata",
                "hora": "13:28",
                "fuente": "MEData",
                "texto": "Monitoreo río Belén — nivel estable.",
            },
        ]
    }


@enrutador.get("/inundaciones")
async def zonas_inundacion():
    return {
        "zonas": [
            {"nombre": "Deprimido La 33", "lat": 6.252, "lng": -75.582, "nivel": "bajo"},
            {"nombre": "Sector Bulerías", "lat": 6.248, "lng": -75.575, "nivel": "medio"},
        ]
    }
