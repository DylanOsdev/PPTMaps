"""Test E2E completo post-pivot Clima + Seguridad Ciudadana.

Valida que todos los endpoints y servicios funcionen correctamente
después de eliminar módulos de tráfico/navegación.
"""
import sys
from pathlib import Path

# Agregar backend al path
repo_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(repo_root))

import requests


BASE_URL = "http://localhost:8000"
TEST_USER = {
    "email": "test_pivot@example.com",
    "password": "TestPivot123!",
    "full_name": "Test Pivot User"
}


def get_auth_token():
    """Obtener token de autenticación."""
    # Intentar registrar (puede fallar si ya existe)
    requests.post(f"{BASE_URL}/api/v1/auth/register", json=TEST_USER)
    
    # Login
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        data={"username": TEST_USER["email"], "password": TEST_USER["password"]}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    return None


def test_01_health_check():
    """Test 1: Health check básico."""
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "ok"]
    print("✅ Test 1: Health check OK")


def test_02_db_health_check():
    """Test 2: Health check de base de datos."""
    response = requests.get(f"{BASE_URL}/health/db")
    assert response.status_code == 200
    data = response.json()
    assert "connected" in data["database"]
    print("✅ Test 2: DB health check OK")
    
    # ===== AUTENTICACIÓN =====
    
    @pytest.mark.asyncio
    async def test_03_auth_flow(self, client):
        """Test 3: Flujo completo de autenticación."""
        # Ya validado en auth_token fixture
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": TEST_USER["email"], "password": TEST_USER["password"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        print("✅ Test 3: Auth flow OK")
    
    # ===== ENDPOINTS PÚBLICOS =====
    
    @pytest.mark.asyncio
    async def test_04_public_reports(self, client):
        """Test 4: Reportes públicos."""
        response = await client.get("/api/v1/public/reports")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Test 4: Public reports OK ({len(data)} reportes)")
    
    @pytest.mark.asyncio
    async def test_05_accidents_geojson(self, client):
        """Test 5: Accidentes en formato GeoJSON."""
        response = await client.get("/api/v1/public/accidents/geojson?limit=100")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert "features" in data
        print(f"✅ Test 5: Accidents GeoJSON OK ({len(data['features'])} features)")
    
    @pytest.mark.asyncio
    async def test_06_accident_zones(self, client):
        """Test 6: Zonas de accidentalidad."""
        response = await client.get("/api/v1/public/accident-zones")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Test 6: Accident zones OK ({len(data)} zonas)")
    
    @pytest.mark.asyncio
    async def test_07_flood_zones(self, client):
        """Test 7: Zonas de inundación."""
        response = await client.get("/api/v1/public/flood-zones")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Test 7: Flood zones OK ({len(data)} zonas)")
    
    @pytest.mark.asyncio
    async def test_08_weather_stats(self, client):
        """Test 8: Estadísticas de clima."""
        response = await client.get("/api/v1/public/weather/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_records" in data or "message" in data
        print("✅ Test 8: Weather stats OK")
    
    @pytest.mark.asyncio
    async def test_09_nearby_search(self, client):
        """Test 9: Búsqueda geográfica cercana."""
        # Centro de Medellín: Parque Bolívar
        response = await client.get(
            "/api/v1/public/nearby",
            params={"lat": 6.2514, "lng": -75.5636, "radius_km": 2.0}
        )
        assert response.status_code == 200
        data = response.json()
        assert "accidents" in data
        assert "reports" in data
        print(f"✅ Test 9: Nearby search OK (accidents={len(data['accidents'])}, reports={len(data['reports'])})")
    
    @pytest.mark.asyncio
    async def test_10_stats_general(self, client):
        """Test 10: Estadísticas generales."""
        response = await client.get("/api/v1/public/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_accidents" in data
        assert "total_reports" in data
        print(f"✅ Test 10: Stats OK (accidents={data['total_accidents']}, reports={data['total_reports']})")
    
    # ===== REPORTES CIUDADANOS =====
    
    @pytest.mark.asyncio
    async def test_11_create_report(self, client, auth_token):
        """Test 11: Crear reporte ciudadano."""
        report_data = {
            "title": "Test E2E - Inundación en vía",
            "description": "Test automático post-pivot",
            "report_type": "flood",
            "latitude": 6.2442,
            "longitude": -75.5812,
            "severity": "medium"
        }
        response = await client.post(
            "/api/v1/reports/",
            json=report_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["title"] == report_data["title"]
        print(f"✅ Test 11: Create report OK (ID={data['id']})")
    
    # ===== ZONAS DE ACCIDENTALIDAD =====
    
    @pytest.mark.asyncio
    async def test_12_accident_zones_endpoint(self, client):
        """Test 12: Endpoint de zonas de accidentalidad."""
        response = await client.get("/api/v1/accident-zones/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Test 12: Accident zones endpoint OK ({len(data)} zonas)")
    
    # ===== RIESGOS DE INUNDACIÓN =====
    
    @pytest.mark.asyncio
    async def test_13_flood_hazards_endpoint(self, client):
        """Test 13: Endpoint de riesgos de inundación."""
        response = await client.get("/api/v1/flood-hazards/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Test 13: Flood hazards endpoint OK ({len(data)} hazards)")
    
    # ===== CHATBOT =====
    
    @pytest.mark.asyncio
    async def test_14_chatbot_query(self, client, auth_token):
        """Test 14: Query al chatbot (puede fallar si ML no está disponible)."""
        query_data = {
            "message": "¿Cuáles son las zonas más peligrosas de Medellín?",
            "user_location": {"lat": 6.2442, "lng": -75.5812}
        }
        response = await client.post(
            "/api/v1/chatbot/query",
            json=query_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Puede fallar si ML no está disponible, pero no debe retornar 500
        assert response.status_code in [200, 503]
        if response.status_code == 200:
            data = response.json()
            assert "response" in data
            print("✅ Test 14: Chatbot query OK")
        else:
            print("⚠️ Test 14: Chatbot not available (ML module missing)")
    
    # ===== VALIDACIÓN DE ENDPOINTS ELIMINADOS =====
    
    @pytest.mark.asyncio
    async def test_15_removed_endpoints(self, client, auth_token):
        """Test 15: Verificar que endpoints eliminados devuelvan 404."""
        removed_endpoints = [
            "/api/v1/vehicles/",
            "/api/v1/routes/optimize",
            "/api/v1/telemetry/"
        ]
        
        for endpoint in removed_endpoints:
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert response.status_code == 404, f"Endpoint {endpoint} should return 404"
        
        print("✅ Test 15: Removed endpoints return 404 as expected")
    
    # ===== VALIDACIÓN DE TABLAS ELIMINADAS =====
    
    @pytest.mark.asyncio
    async def test_16_database_schema(self, client):
        """Test 16: Verificar que tablas eliminadas no existan."""
        # Endpoint de stats debería funcionar sin tablas de vehicles/telemetry
        response = await client.get("/api/v1/public/stats")
        assert response.status_code == 200
        data = response.json()
        # No debe haber keys relacionadas con vehicles o telemetry
        assert "total_vehicles" not in data
        assert "telemetry_count" not in data
        print("✅ Test 16: Database schema clean (no vehicle/telemetry references)")


def main():
    """Ejecutar tests E2E."""
    import pytest
    
    print("\n" + "="*60)
    print("TEST E2E POST-PIVOT: CLIMA + SEGURIDAD CIUDADANA")
    print("="*60 + "\n")
    
    # Ejecutar tests
    exit_code = pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--asyncio-mode=auto",
        "-W", "ignore::DeprecationWarning"
    ])
    
    print("\n" + "="*60)
    if exit_code == 0:
        print("✅ TODOS LOS TESTS PASARON - PIVOT EXITOSO")
    else:
        print("❌ ALGUNOS TESTS FALLARON - REVISAR ERRORES")
    print("="*60 + "\n")
    
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
