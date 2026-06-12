#!/usr/bin/env python3
"""Test sistema sin autenticación - reportes públicos y anónimos"""
import requests

BASE_URL = "http://localhost:8000"

def main():
    print("\n" + "="*70)
    print("TEST SISTEMA SIN AUTENTICACIÓN")
    print("="*70 + "\n")
    
    passed = 0
    failed = 0
    
    # Test 1: Endpoints de auth eliminados
    try:
        endpoints = [
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/users/"
        ]
        for endpoint in endpoints:
            r = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            assert r.status_code == 404, f"{endpoint} should return 404, got {r.status_code}"
        print("✅ Test 1: Endpoints de auth eliminados correctamente")
        passed += 1
    except Exception as e:
        print(f"❌ Test 1: FAILED - {e}")
        failed += 1
    
    # Test 2: Crear reporte sin autenticación (anónimo)
    try:
        report_data = {
            "report_type": "flood",
            "description": "Inundación test sin auth",
            "latitude": 6.2442,
            "longitude": -75.5812
        }
        r = requests.post(f"{BASE_URL}/api/v1/reports/", json=report_data, timeout=5)
        assert r.status_code in [200, 201], f"Expected 200/201, got {r.status_code}"
        data = r.json()
        assert data["report_type"] == "flood"
        assert data["reporter_name"] is None
        assert data["reporter_email"] is None
        print(f"✅ Test 2: Reporte anónimo creado OK (ID={data['id']})")
        passed += 1
    except Exception as e:
        print(f"❌ Test 2: FAILED - {e}")
        failed += 1
    
    # Test 3: Crear reporte con nombre y email opcionales
    try:
        report_data = {
            "report_type": "obstruction",
            "description": "Árbol caído",
            "latitude": 6.2500,
            "longitude": -75.5700,
            "reporter_name": "Juan Pérez",
            "reporter_email": "juan@example.com"
        }
        r = requests.post(f"{BASE_URL}/api/v1/reports/", json=report_data, timeout=5)
        assert r.status_code in [200, 201]
        data = r.json()
        assert data["reporter_name"] == "Juan Pérez"
        assert data["reporter_email"] == "juan@example.com"
        print(f"✅ Test 3: Reporte con nombre/email opcionales OK (ID={data['id']})")
        passed += 1
    except Exception as e:
        print(f"❌ Test 3: FAILED - {e}")
        failed += 1
    
    # Test 4: Listar reportes sin autenticación
    try:
        r = requests.get(f"{BASE_URL}/api/v1/reports/", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✅ Test 4: Listar reportes sin auth OK ({len(data)} reportes)")
        passed += 1
    except Exception as e:
        print(f"❌ Test 4: FAILED - {e}")
        failed += 1
    
    # Test 5: Ver un reporte específico sin autenticación
    try:
        r = requests.get(f"{BASE_URL}/api/v1/reports/1", timeout=5)
        assert r.status_code in [200, 404]  # 404 si no existe, OK
        if r.status_code == 200:
            data = r.json()
            assert "report_type" in data
        print("✅ Test 5: Ver reporte específico sin auth OK")
        passed += 1
    except Exception as e:
        print(f"❌ Test 5: FAILED - {e}")
        failed += 1
    
    # Test 6: Crear reporte con email inválido (debe aceptarse igual)
    try:
        report_data = {
            "report_type": "other",
            "description": "Test email inválido",
            "latitude": 6.2400,
            "longitude": -75.5600,
            "reporter_email": "email-sin-formato"  # Email inválido
        }
        r = requests.post(f"{BASE_URL}/api/v1/reports/", json=report_data, timeout=5)
        assert r.status_code in [200, 201]  # Se acepta igual
        print("✅ Test 6: Email sin validación estricta (acepta cualquier string)")
        passed += 1
    except Exception as e:
        print(f"❌ Test 6: FAILED - {e}")
        failed += 1
    
    # Test 7: Verificar que tabla users no se usa
    try:
        # Los reportes no deben tener reporter_id
        r = requests.get(f"{BASE_URL}/api/v1/reports/?limit=1", timeout=5)
        if r.status_code == 200 and len(r.json()) > 0:
            data = r.json()[0]
            assert "reporter_id" not in data or data.get("reporter_id") is None
        print("✅ Test 7: Reportes sin FK a users (reporter_id no presente)")
        passed += 1
    except Exception as e:
        print(f"❌ Test 7: FAILED - {e}")
        failed += 1
    
    print("\n" + "="*70)
    print(f"RESULTADOS: {passed} pasaron, {failed} fallaron")
    
    if failed == 0:
        print("✅ SISTEMA SIN AUTENTICACIÓN FUNCIONANDO CORRECTAMENTE")
        print("="*70 + "\n")
        return 0
    else:
        print(f"⚠️  {failed} tests fallaron")
        print("="*70 + "\n")
        return 1

if __name__ == "__main__":
    exit(main())
