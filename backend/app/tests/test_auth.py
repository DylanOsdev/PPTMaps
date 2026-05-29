import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_register_user(client: AsyncClient):
    """Registrar un nuevo usuario debe retornar 201."""
    response = await client.post("/api/v1/auth/register", json={
        "email": "nuevo@movimed.co",
        "password": "SecurePass1!",
        "full_name": "Nuevo Usuario",
        "role": "USER",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "nuevo@movimed.co"
    assert "id" in data

async def test_register_duplicate_user(client: AsyncClient):
    """Registrar el mismo email dos veces debe retornar 400."""
    payload = {"email": "dup@movimed.co", "password": "Pass123!", "role": "USER"}
    await client.post("/api/v1/auth/register", json=payload)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400

async def test_login_success(client: AsyncClient, registered_user: dict):
    """Login con credenciales correctas debe retornar access_token."""
    response = await client.post("/api/v1/auth/login", data={
        "username": registered_user["email"],
        "password": registered_user["password"],
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

async def test_login_wrong_password(client: AsyncClient, registered_user: dict):
    """Login con contraseña incorrecta debe retornar 401."""
    response = await client.post("/api/v1/auth/login", data={
        "username": registered_user["email"],
        "password": "WrongPassword!",
    })
    assert response.status_code == 401

async def test_get_me(client: AsyncClient, auth_headers: dict):
    """GET /auth/me debe retornar el perfil del usuario autenticado."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "email" in data

async def test_get_me_unauthorized(client: AsyncClient):
    """GET /auth/me sin token debe retornar 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
