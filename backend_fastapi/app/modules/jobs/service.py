from uuid import UUID

from celery.exceptions import CeleryError
from celery.result import AsyncResult
from fastapi.encoders import jsonable_encoder
from kombu.exceptions import KombuError
from redis.exceptions import RedisError

from app.core.exceptions import AppError
from app.modules.jobs.schemas import JobQueued, JobStatus
from app.queue.celery_app import celery_app


def queued(task_id: str) -> JobQueued:
    identifier = UUID(task_id)
    return JobQueued(task_id=identifier, status_url=f"/api/jobs/{identifier}")


def status(task_id: UUID) -> JobStatus:
    task = AsyncResult(str(task_id), app=celery_app)
    try:
        state = task.state
        if task.successful():
            return JobStatus(
                task_id=task_id,
                state=state,
                ready=True,
                result=jsonable_encoder(task.result),
            )
        if task.failed():
            return JobStatus(
                task_id=task_id,
                state=state,
                ready=True,
                error=str(task.result)[:1000],
            )
        progress = task.info if isinstance(task.info, dict) else None
        return JobStatus(
            task_id=task_id,
            state=state,
            ready=task.ready(),
            result=jsonable_encoder(progress),
        )
    except (CeleryError, KombuError, RedisError, OSError) as exc:
        raise AppError("La cola de trabajos no está disponible", 503, "QUEUE_UNAVAILABLE") from exc
