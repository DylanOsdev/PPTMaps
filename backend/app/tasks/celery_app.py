from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "movimed_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.cron_jobs"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Bogota",
    enable_utc=True,
    beat_schedule={
        "siata-sync-every-15-min": {
            "task": "siata.sync_flood_hazards",
            "schedule": crontab(minute="*/15"),
        },
        "weather-sync-every-15-min": {
            "task": "weather.sync",
            "schedule": crontab(minute="*/15"),
        },
        "weather-alerts-every-15-min": {
            "task": "weather.generate_alerts",
            "schedule": crontab(minute="*/15"),
        },
        "air-quality-sync-hourly": {
            "task": "air_quality.sync",
            "schedule": crontab(minute="0"),
        },
        "weather-events-sync-hourly": {
            "task": "weather_events.sync",
            "schedule": crontab(minute="30"),  # Cada hora a los :30
        },
        "risk-model-train-daily": {
            "task": "ml.train_risk_model",
            "schedule": crontab(hour=4, minute=0),  # Diario a las 4 AM
        },
        "risk-scores-update-hourly": {
            "task": "ml.update_risk_scores",
            "schedule": crontab(minute="45"),  # Cada hora a los :45
        },
    },
)
