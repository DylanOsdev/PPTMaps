from fastapi import APIRouter

from aplicacion.esquemas.reporte import ReporteCrear, ReporteLeer

enrutador = APIRouter()


@enrutador.post("", response_model=ReporteLeer, status_code=201)
async def crear_reporte(payload: ReporteCrear):
    return ReporteLeer(id=1, type=payload.type, lat=payload.lat, lng=payload.lng, estado="activo")
