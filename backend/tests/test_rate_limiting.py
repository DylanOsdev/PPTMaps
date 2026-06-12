"""
Test simple para verificar el rate limiting de reportes.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    """Cliente HTTP asíncrono para testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_rate_limit_blocks_after_5_reports(client: AsyncClient):
    """Verifica que el rate limiting bloquea después de 5 reportes."""
    report_data = {
        "report_type": "accident",
        "description": "Test de rate limiting",
        "latitude": 6.2476,
        "longitude": -75.5658,
    }
    
    # Enviar 5 reportes (todos deben pasar - 201 Created)
    for i in range(5):
        response = await client.post("/api/v1/reports/", json=report_data)
        print(f"Request {i+1}: {response.status_code}")
        assert response.status_code == 201, f"Request {i+1} falló con {response.status_code}"
    
    # El 6to debe ser bloqueado (429 Too Many Requests)
    response = await client.post("/api/v1/reports/", json=report_data)
    print(f"Request 6 (debe ser bloqueada): {response.status_code}")
    assert response.status_code == 429
    
    # Verificar mensaje en español
    response_json = response.json()
    print(f"Mensaje: {response_json}")
    assert "5 reportes por hora" in response_json["detail"]


@pytest.mark.asyncio
async def test_rate_limit_message_in_spanish(client: AsyncClient):
    """Verifica que el mensaje de error está en español."""
    report_data = {
        "report_type": "accident",
        "description": "Test mensaje español",
        "latitude": 6.2476,
        "longitude": -75.5658,
    }
    
    # Enviar 6 reportes para forzar el bloqueo
    for _ in range(6):
        response = await client.post("/api/v1/reports/", json=report_data)
    
    # El último debe estar bloqueado con mensaje en español
    if response.status_code == 429:
        response_json = response.json()
        assert "5 reportes por hora" in response_json["detail"]
        assert "intenta de nuevo más tarde" in response_json["detail"]
        print(f"✅ Mensaje correcto: {response_json['detail']}")
