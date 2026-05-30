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
    },
)
