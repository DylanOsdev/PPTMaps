from fastapi import APIRouter

from aplicacion.api.v1.endpoints import estado, prediccion, reportes, rutas, siata, telemetria

enrutador_api = APIRouter()
enrutador_api.include_router(estado.enrutador, tags=["estado"])
enrutador_api.include_router(rutas.enrutador, prefix="/rutas", tags=["rutas"])
enrutador_api.include_router(reportes.enrutador, prefix="/reportes", tags=["reportes"])
enrutador_api.include_router(telemetria.enrutador, prefix="/telemetria", tags=["telemetria"])
enrutador_api.include_router(siata.enrutador, prefix="/siata", tags=["siata"])
enrutador_api.include_router(prediccion.enrutador, prefix="/prediccion", tags=["prediccion"])
