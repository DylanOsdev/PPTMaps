from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "movimed_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.worker"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Bogota",
    enable_utc=True,
    # Programación periódica de tareas (cron)
    beat_schedule={
        "check-overspeed-every-minute": {
            "task": "app.tasks.worker.check_overspeed_alerts",
            "schedule": 60.0,  # cada 60 segundos
        },
        "calculate-hourly-stats": {
            "task": "app.tasks.worker.calculate_hourly_stats",
            "schedule": 3600.0,  # cada hora
        },
    },
)
