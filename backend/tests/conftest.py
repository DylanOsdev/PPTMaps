"""
Fixtures compartidos para los tests de PPTMaps.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.main import app
from app.db.base import Base
from app.core.config import settings


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Sesión de BD limpia para cada test."""
    # Crear engine dentro de la fixture para usar el event loop correcto
    engine = create_async_engine(
        settings.ASYNC_DATABASE_URI.replace("movimed_test", "movimed"), 
        echo=False,
        poolclass=None
    )
    
    # Crear sesión
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Asegurar tabla existe
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Limpiar tabla air_quality_readings antes del test
        try:
            await session.execute(text("TRUNCATE TABLE air_quality_readings CASCADE"))
            await session.commit()
        except Exception:
            await session.rollback()
        
        yield session
        
        await session.rollback()
    
    # Cleanup engine
    await engine.dispose()


@pytest.fixture
async def client():
    """Cliente HTTP asíncrono para testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
