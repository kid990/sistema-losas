from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "sirlod",
    broker=settings.queue_broker_url,
    backend=settings.queue_result_backend,
    include=(
        "app.queue.tasks.email",
        "app.queue.tasks.permissions",
        "app.queue.tasks.reports",
        "app.queue.tasks.users",
    ),
)

celery_app.conf.update(
    accept_content=("json",),
    broker_connection_retry_on_startup=True,
    broker_connection_timeout=3,
    broker_transport_options={"visibility_timeout": settings.celery_task_time_limit_seconds + 60},
    enable_utc=True,
    result_expires=settings.celery_result_expires_seconds,
    result_serializer="json",
    task_acks_late=True,
    task_default_queue="default",
    task_ignore_result=False,
    task_publish_retry=False,
    task_reject_on_worker_lost=True,
    task_routes={
        "sirlod.email.*": {"queue": "emails"},
        "sirlod.permissions.*": {"queue": "documents"},
        "sirlod.reports.*": {"queue": "reports"},
        "sirlod.users.*": {"queue": "sync"},
    },
    task_serializer="json",
    task_soft_time_limit=max(settings.celery_task_time_limit_seconds - 30, 1),
    task_time_limit=settings.celery_task_time_limit_seconds,
    task_track_started=True,
    timezone="America/Lima",
    worker_cancel_long_running_tasks_on_connection_loss=True,
    worker_prefetch_multiplier=1,
)
