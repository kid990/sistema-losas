import asyncio
from typing import Literal

from app.modules.reportes import service
from app.queue.celery_app import celery_app
from app.queue.database import task_session


async def _regenerate_report(
    periodo: Literal["mensual", "anual"], anio: int, mes: int, admin_id: int
) -> dict[str, str | int | bool]:
    async with task_session() as db:
        document = await service.regenerate_pdf(db, periodo, anio, mes, admin_id)
    return {
        "success": True,
        "periodo": periodo,
        "anio": anio,
        "mes": mes,
        "nombre_archivo": document.filename,
    }


@celery_app.task(  # type: ignore[untyped-decorator]
    name="sirlod.reports.regenerate",
    autoretry_for=(OSError, TimeoutError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def regenerate_report_task(
    periodo: Literal["mensual", "anual"], anio: int, mes: int, admin_id: int
) -> dict[str, str | int | bool]:
    return asyncio.run(_regenerate_report(periodo, anio, mes, admin_id))
