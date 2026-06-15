import os

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.db.database import get_db
from app.db.redis import get_redis

# ── Base de datos PostGIS real para tests ──────────────────────────────────────
# SQLite no implementa funciones PostGIS (ST_DWithin, ST_MakePoint), por lo que
# los tests geoespaciales requieren un Postgres+PostGIS real (docker-compose.test.yml).
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5434/movimed_test",
)

# NullPool: cada checkout abre una conexión asyncpg nueva y la cierra al devolverla.
# Evita reusar conexiones entre los distintos event loops que crea pytest-asyncio.
test_engine = create_async_engine(TEST_DATABASE_URL, future=True, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db

# El ws_router usa app.db.database.async_session_maker directamente (no vía Depends),
# así que lo reapuntamos a la BD de test para que el WebSocket lea de PostGIS de test.
import app.db.database as _database

_database.async_session_maker = TestSessionLocal


# ── Redis falso en memoria para tests (telemetría CQRS) ────────────────────────
import fakeredis.aioredis

# Se recrea por test (fixture redis_client) para quedar atado al event loop activo;
# crearlo a nivel de módulo lo ata al primer loop y rompe los demás tests.
_fake_redis: fakeredis.aioredis.FakeRedis | None = None


def override_get_redis():
    return _fake_redis


app.dependency_overrides[get_redis] = override_get_redis


@pytest_asyncio.fixture(autouse=True)
async def redis_client():
    """Cliente fakeredis fresco por test, compartido entre endpoint y task."""
    global _fake_redis
    _fake_redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield _fake_redis
    await _fake_redis.aclose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Recrea el esquema completo en la BD de prueba antes de la suite."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        # Tablas legacy creadas por migraciones raw SQL (no tienen modelo ORM)
        from sqlalchemy import text as sa_text
        await conn.execute(sa_text("""
            CREATE TABLE IF NOT EXISTS historical_weather_medellin (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                temperature_c REAL,
                precipitation_mm REAL,
                humidity INTEGER,
                UNIQUE(timestamp)
            )
        """))
        await conn.execute(sa_text("""
            CREATE INDEX IF NOT EXISTS idx_historical_weather_timestamp
            ON historical_weather_medellin(timestamp)
        """))
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def clean_tables():
    """Trunca todas las tablas antes de cada test para garantizar aislamiento."""
    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE'))
    yield


@pytest_asyncio.fixture
async def db_session():
    """Sesión de BD directa para tests de servicios (no vía HTTP)."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    """Cliente HTTP asíncrono para hacer peticiones a la API en tests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers() -> dict:
    """Headers vacíos (la API actual no requiere autenticación)."""
    return {}
