import pytest
from unittest.mock import AsyncMock, patch

from app.main import lifespan


@pytest.mark.asyncio
async def test_lifespan_seeds_zones_on_startup():
    """Al arrancar, el lifespan debe ejecutar seed de zonas si la tabla está vacía."""
    mock_app = AsyncMock()

    with patch("app.main.verify_db_connection", new_callable=AsyncMock) as mock_verify, \
         patch("app.main.seed_zones_if_empty", new_callable=AsyncMock) as mock_seed, \
         patch("app.main.seed_initial_data", new_callable=AsyncMock) as mock_initial, \
         patch("app.main.start_background_tasks", new_callable=AsyncMock), \
         patch("app.main.stop_background_tasks", new_callable=AsyncMock), \
         patch("app.main.engine") as mock_engine:
        
        mock_engine.dispose = AsyncMock()
        
        async with lifespan(mock_app):
            pass  # contexto ejecuta startup
        
        mock_verify.assert_called_once()
        mock_seed.assert_called_once()
        mock_initial.assert_called_once()


@pytest.mark.asyncio
async def test_lifespan_raises_if_db_fails():
    """Si la verificación de DB falla, el arranque debe propagar la excepción."""
    mock_app = AsyncMock()

    with patch("app.main.verify_db_connection", new_callable=AsyncMock, side_effect=ConnectionError("DB down")):
        with pytest.raises(ConnectionError, match="DB down"):
            async with lifespan(mock_app):
                pass
