import pytest

pytestmark = pytest.mark.asyncio


async def test_spa_deep_link_serves_index(client):
    """Una ruta del cliente (no-API, no-archivo) debe servir el SPA, no 404.

    Solo aplica si el frontend está compilado (frontend/dist). Si no, se omite.
    """
    from app.main import resolve_frontend_dir, PROJECT_ROOT
    if resolve_frontend_dir(PROJECT_ROOT) is None:
        pytest.skip("frontend/dist no compilado")

    resp = await client.get("/dashboard")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


async def test_unknown_api_route_still_404(client):
    """El fallback SPA NO debe tragarse las rutas /api inexistentes."""
    resp = await client.get("/api/v1/this-does-not-exist")
    assert resp.status_code == 404
