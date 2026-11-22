from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.core.config import settings
from app.core.exceptions import AppError
from app.modules.jobs.service import queued
from app.queue import dispatch
from app.queue.celery_app import celery_app
from app.queue.tasks.email import send_email_task


def test_celery_registers_domain_routes() -> None:
    routes = celery_app.conf.task_routes
    assert routes["sirlod.email.*"]["queue"] == "emails"
    assert routes["sirlod.permissions.*"]["queue"] == "documents"
    assert routes["sirlod.reports.*"]["queue"] == "reports"
    assert routes["sirlod.users.*"]["queue"] == "sync"


def test_queued_response_contains_status_url() -> None:
    task_id = "56f7cf76-5ce7-4aef-9317-fc47d4cc5615"
    response = queued(task_id)
    assert response.task_id == UUID(task_id)
    assert response.status_url == f"/api/jobs/{task_id}"


def test_enqueue_rejects_when_queue_is_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "queue_enabled", False)
    with pytest.raises(AppError) as exc_info:
        dispatch.enqueue(send_email_task, "user@example.com", "Asunto", "Texto")
    assert exc_info.value.status_code == 503
    assert exc_info.value.code == "QUEUE_DISABLED"


@pytest.mark.asyncio
async def test_email_falls_back_to_direct_send_when_queue_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    direct_send = AsyncMock(return_value=True)
    monkeypatch.setattr(settings, "queue_enabled", False)
    monkeypatch.setattr(dispatch, "send_email", direct_send)

    result = await dispatch.dispatch_email("user@example.com", "Asunto", "Texto")

    assert result is True
    direct_send.assert_awaited_once_with("user@example.com", "Asunto", "Texto", None)
