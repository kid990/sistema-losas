import logging
from typing import Any

from celery import Task
from celery.exceptions import CeleryError
from kombu.exceptions import KombuError

from app.core.config import settings
from app.core.exceptions import AppError
from app.integrations.email import send_email

logger = logging.getLogger(__name__)


def enqueue(task: Task, *args: Any, queue: str | None = None) -> str:
    """Publica un trabajo y devuelve su identificador para consultar el estado."""
    if not settings.queue_enabled:
        raise AppError("La cola de trabajos no está habilitada", 503, "QUEUE_DISABLED")
    try:
        result = task.apply_async(args=args, queue=queue)
    except (CeleryError, KombuError, OSError) as exc:
        logger.exception("No se pudo publicar el trabajo %s", task.name)
        raise AppError("La cola de trabajos no está disponible", 503, "QUEUE_UNAVAILABLE") from exc
    return str(result.id)


async def dispatch_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Encola correos; si la cola está apagada, conserva el comportamiento local anterior."""
    if not settings.queue_enabled:
        return await send_email(to, subject, text, html)

    from app.queue.tasks.email import send_email_task

    try:
        send_email_task.apply_async(args=(to, subject, text, html), queue="emails")
        return True
    except (CeleryError, KombuError, OSError):
        logger.exception("No se pudo encolar el correo para %s", to)
        if settings.queue_fail_open:
            return await send_email(to, subject, text, html)
        return False
