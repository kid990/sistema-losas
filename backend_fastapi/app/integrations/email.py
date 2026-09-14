import asyncio
import logging
from email.message import EmailMessage
from pathlib import Path

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Envía un correo o registra el intento localmente si SMTP no está configurado."""
    if not settings.mail_host or not settings.mail_user or not settings.mail_password:
        path = Path(settings.mail_log_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        line = f"TO: {to} | SUBJECT: {subject}\n"
        await asyncio.to_thread(_append_text, path, line)
        logger.info("Correo registrado localmente para %s", to)
        return True

    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.mail_host,
            port=settings.mail_port,
            username=settings.mail_user,
            password=settings.mail_password,
            start_tls=not settings.mail_secure,
            use_tls=settings.mail_secure,
            timeout=10,
        )
        return True
    except (aiosmtplib.SMTPException, OSError):
        logger.exception("No se pudo enviar correo a %s", to)
        return False


def _append_text(path: Path, text: str) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(text)
