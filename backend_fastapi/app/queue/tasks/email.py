import asyncio

from app.integrations.email import send_email
from app.queue.celery_app import celery_app


@celery_app.task(  # type: ignore[untyped-decorator]
    name="sirlod.email.send",
    autoretry_for=(OSError, RuntimeError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=5,
)
def send_email_task(to: str, subject: str, text: str, html: str | None = None) -> bool:
    sent = asyncio.run(send_email(to, subject, text, html))
    if not sent:
        raise RuntimeError("No se pudo entregar el correo")
    return True
