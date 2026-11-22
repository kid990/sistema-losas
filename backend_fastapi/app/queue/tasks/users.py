import asyncio
from typing import Any

from app.modules.usuarios import service
from app.queue.celery_app import celery_app
from app.queue.database import task_session


async def _load_users() -> dict[str, Any]:
    async with task_session() as db:
        return await service.load_users(db)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="sirlod.users.synchronize",
    autoretry_for=(OSError, TimeoutError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def synchronize_users_task() -> dict[str, Any]:
    return asyncio.run(_load_users())
