from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# ── Motor asíncrono ───────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    echo=False,        # Cambiar a True en desarrollo para ver el SQL generado
    future=True,
    pool_size=20,
    max_overflow=10,
)

# ── Fábrica de sesiones asíncronas ────────────────────────────────────────────
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# ── Dependencia FastAPI ───────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Generador que provee una sesión de base de datos asíncrona.
    - Hace commit automático al finalizar sin errores.
    - Hace rollback si ocurre cualquier excepción.
    - Siempre cierra la sesión al terminar.
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
