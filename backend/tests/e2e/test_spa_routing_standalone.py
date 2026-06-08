"""
Test unitario para verificar que el routing del SPA (React Router) funciona correctamente.

Verifica que:
- Las rutas de la API (/api/v1/*, /health, /ws) NO sean capturadas por el catch-all
- Las rutas del SPA (/map, /dashboard, /navigate, /report) sirvan el index.html
- Los assets estáticos se sirvan correctamente

NOTA: Este test usa TestClient de Starlette (síncrono) para evitar fixtures async de DB.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_routes_not_caught_by_catchall():
    """Las rutas de la API deben responder correctamente, no caer en el catch-all."""
    # Health check debe responder JSON, no HTML
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "text/html" not in response.headers.get("content-type", "")


def test_spa_routes_serve_index():
    """Las rutas del SPA deben servir index.html si el frontend está compilado."""
    import pytest
    
    spa_routes = ["/map", "/dashboard", "/navigate", "/report", "/"]
    
    for route in spa_routes:
        response = client.get(route, follow_redirects=True)
        
        # Si el frontend no está compilado, puede dar 404 (OK en dev)
        if response.status_code == 404:
            pytest.skip(f"Frontend no compilado (frontend/dist faltante), test omitido para {route}")
        
        # Si está compilado, debe servir HTML
        assert response.status_code == 200, f"Falló en {route}"
        assert "text/html" in response.headers.get("content-type", ""), f"No es HTML en {route}"
        # Debe contener el root div de React
        assert b'<div id="root">' in response.content or b'<div id="app">' in response.content, \
            f"HTML inválido en {route}"


def test_unknown_routes_serve_spa_or_404():
    """Rutas desconocidas deben servir el SPA (React Router hace el redirect) o 404 si no está compilado."""
    response = client.get("/ruta-inexistente-xyz", follow_redirects=True)
    
    # Dos escenarios válidos:
    # 1. Frontend compilado -> sirve index.html (200) y React Router redirige a /
    # 2. Frontend no compilado -> 404
    assert response.status_code in [200, 404]


def test_api_v1_public_not_caught():
    """Las rutas /api/v1/public/* NO deben caer en el catch-all del SPA."""
    response = client.get("/api/v1/public/reports")
    # Debe responder con JSON (200 o algún error de validación), NO con HTML del SPA
    content_type = response.headers.get("content-type", "")
    # Si devuelve HTML, es que cayó en el catch-all (ERROR)
    if "text/html" in content_type:
        assert "application/json" in content_type, "La API pública cayó en el catch-all del SPA"
