"""Tests para endpoints públicos de reportes ciudadanos (sin auth)."""
import pytest
from unittest.mock import AsyncMock, patch

from app.models.report import ReportType

pytestmark = pytest.mark.asyncio


async def test_get_public_reports_empty(client):
    """GET /public/reports debe devolver lista vacía si no hay reportes."""
    resp = await client.get("/api/v1/public/reports")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_public_reports_with_data(client, db_session):
    """GET /public/reports debe devolver reportes existentes."""
    from app.crud import crud_report
    from app.schemas.report import ReportCreate
    
    # Crear 2 reportes
    await crud_report.create_report(
        db_session,
        report_in=ReportCreate(
            report_type=ReportType.accident,
            latitude=6.25,
            longitude=-75.57,
            description="Colisión en la autopista"
        ),
        reporter_id=None
    )
    await crud_report.create_report(
        db_session,
        report_in=ReportCreate(
            report_type=ReportType.flood,
            latitude=6.26,
            longitude=-75.58,
            description="Inundación Feria de Ganado"
        ),
        reporter_id=None
    )
    
    resp = await client.get("/api/v1/public/reports")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    types = [r["report_type"] for r in data]
    assert "accident" in types and "flood" in types


async def test_get_public_reports_filter_by_type(client, db_session):
    """GET /public/reports?report_type=flood debe filtrar por tipo."""
    from app.crud import crud_report
    from app.schemas.report import ReportCreate
    
    await crud_report.create_report(
        db_session,
        report_in=ReportCreate(
            report_type=ReportType.accident,
            latitude=6.25,
            longitude=-75.57,
            description="Colisión"
        ),
        reporter_id=None
    )
    await crud_report.create_report(
        db_session,
        report_in=ReportCreate(
            report_type=ReportType.flood,
            latitude=6.26,
            longitude=-75.58,
            description="Inundación"
        ),
        reporter_id=None
    )
    
    resp = await client.get("/api/v1/public/reports", params={"report_type": "flood"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["report_type"] == "flood"


async def test_get_public_reports_respects_limit(client, db_session):
    """GET /public/reports?limit=1 debe respetar el límite."""
    from app.crud import crud_report
    from app.schemas.report import ReportCreate
    
    for i in range(3):
        await crud_report.create_report(
            db_session,
            report_in=ReportCreate(
                report_type=ReportType.obstruction,
                latitude=6.25 + i*0.01,
                longitude=-75.57,
                description=f"Obstáculo {i}"
            ),
            reporter_id=None
        )
    
    resp = await client.get("/api/v1/public/reports", params={"limit": 1})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_create_public_report_success(client, db_session):
    """POST /public/reports debe crear reporte sin auth (reporter_id=None)."""
    payload = {
        "report_type": "accident",
        "latitude": 6.2518,
        "longitude": -75.5636,
        "description": "Choque en Parque Berrío"
    }
    
    resp = await client.post("/api/v1/public/reports", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["report_type"] == "accident"
    assert data["latitude"] == 6.2518
    assert data["longitude"] == -75.5636
    assert data["description"] == "Choque en Parque Berrío"
    assert data.get("reporter_name") is None  # Anónimo


async def test_create_public_report_broadcasts_to_websocket(client, db_session):
    """POST /public/reports debe hacer broadcast vía Redis pub/sub."""
    payload = {
        "report_type": "flood",
        "latitude": 6.26,
        "longitude": -75.58,
        "description": "Inundación deprimido"
    }
    
    with patch("app.crud.crud_report.publish_alert") as mock_publish:
        mock_publish.return_value = AsyncMock()
        
        resp = await client.post("/api/v1/public/reports", json=payload)
        assert resp.status_code == 201
        
        # Verificar que se llamó publish_alert con los datos del reporte
        mock_publish.assert_called_once()
        call_args = mock_publish.call_args
        report_data = call_args[0][1]  # segundo arg de publish_alert(redis, data)
        assert report_data["type"] == "new_report"
        assert report_data["data"]["report_type"] == "flood"


async def test_create_public_report_invalid_type_422(client):
    """POST /public/reports con tipo inválido debe devolver 422."""
    payload = {
        "report_type": "tipo_invalido",
        "latitude": 6.25,
        "longitude": -75.57,
        "description": "Test"
    }
    
    resp = await client.post("/api/v1/public/reports", json=payload)
    assert resp.status_code == 422


async def test_create_public_report_missing_coords_422(client):
    """POST /public/reports sin coordenadas debe devolver 422."""
    payload = {
        "report_type": "accident",
        "description": "Sin coordenadas"
    }
    
    resp = await client.post("/api/v1/public/reports", json=payload)
    assert resp.status_code == 422


async def test_create_public_report_resilient_if_redis_fails(client, db_session):
    """POST /public/reports debe crear el reporte aunque Redis falle."""
    payload = {
        "report_type": "obstruction",
        "latitude": 6.25,
        "longitude": -75.57,
        "description": "Obstáculo en vía"
    }
    
    with patch("app.crud.crud_report.get_redis", side_effect=ConnectionError("Redis down")):
        resp = await client.post("/api/v1/public/reports", json=payload)
        # El reporte se crea correctamente aunque el broadcast falle
        assert resp.status_code == 201
        data = resp.json()
        assert data["report_type"] == "obstruction"
