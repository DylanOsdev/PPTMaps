"""
Fixtures compartidos para los tests de PPTMaps.
"""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.main import app
from app.db.base import Base


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/movimed",
)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Sesión de BD limpia para cada test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=None)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        try:
            await session.execute(text("TRUNCATE TABLE air_quality_readings CASCADE"))
            await session.commit()
        except Exception:
            await session.rollback()
        
        yield session
        await session.rollback()
    
    await engine.dispose()


@pytest.fixture
async def client():
    """Cliente HTTP asíncrono para testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
