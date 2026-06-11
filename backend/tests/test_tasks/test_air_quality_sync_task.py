"""Tests para Celery tasks de Air Quality."""
import pytest
from unittest.mock import AsyncMock, patch


def test_sync_air_quality_task_executes():
    """Celery task sync_air_quality ejecuta el servicio de sincronización."""
    # Importar después de definir el test para evitar circular imports
    from app.tasks.cron_jobs import sync_air_quality
    
    # Mock del servicio de sincronización
    with patch("app.tasks.cron_jobs._run_air_quality_sync", return_value=5) as mock_run:
        result = sync_air_quality()
    
    assert result == 5  # Retorna el count de readings insertados
    mock_run.assert_called_once()


@pytest.mark.asyncio
async def test_run_air_quality_sync_calls_service(db_session):
    """_run_air_quality_sync llama al servicio con el cliente correcto."""
    from app.tasks.cron_jobs import _run_air_quality_sync
    
    # Mock del cliente y servicio
    with patch("app.tasks.cron_jobs._create_air_quality_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client_factory.return_value = mock_client
        
        with patch("app.services.air_quality_sync.AirQualitySyncService.sync", return_value=3) as mock_sync:
            result = await _run_air_quality_sync()
    
    assert result == 3
    mock_client_factory.assert_called_once()
    mock_sync.assert_called_once()
