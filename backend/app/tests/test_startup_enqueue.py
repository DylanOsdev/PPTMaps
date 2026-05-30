from unittest.mock import patch

from app.main import enqueue_startup_syncs


def test_enqueue_startup_syncs_encola_weather():
    """Al arrancar, encola weather.sync para que el mapa no quede vacío hasta el próximo beat."""
    with patch("app.tasks.cron_jobs.sync_weather.delay") as delay:
        enqueue_startup_syncs()
    delay.assert_called_once_with()


def test_enqueue_startup_syncs_resiliente_si_broker_caido():
    """Si el broker (Redis) está caído, el arranque NO debe fallar."""
    with patch("app.tasks.cron_jobs.sync_weather.delay", side_effect=OSError("broker down")):
        enqueue_startup_syncs()  # no debe propagar
