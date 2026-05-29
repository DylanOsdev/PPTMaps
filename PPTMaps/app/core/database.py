from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# 1. Crear el Motor (Engine) Asíncrono
# Utilizamos la URL generada en config.py
engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    echo=False,  # Cambiar a True en desarrollo si quieres ver todas las consultas SQL
    future=True,
    pool_size=20,
    max_overflow=10
)

# 2. Crear la factoría de Sesiones Asíncronas
async_session_maker = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autoflush=False
)

# 3. Base Declarativa de la que heredarán todos los modelos
Base = declarative_base()

# 4. Dependencia para inyectar la sesión en FastAPI
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Generador que provee una sesión de base de datos asíncrona.
    Se asegura de cerrar la sesión automáticamente después de la petición.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
