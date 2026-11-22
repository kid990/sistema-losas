import asyncio
from typing import Any

from app.modules.permisos import service
from app.queue.celery_app import celery_app
from app.queue.database import task_session


async def _automatic_review(admin_id: int) -> dict[str, Any]:
    async with task_session() as db:
        return await service.automatic_review(db, admin_id)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="sirlod.permissions.automatic_review",
    autoretry_for=(OSError, TimeoutError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def automatic_review_task(admin_id: int) -> dict[str, Any]:
    return asyncio.run(_automatic_review(admin_id))
