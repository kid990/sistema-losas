from typing import Any

import pytest

from app.core.config import settings
from app.modules.chatbot import service
from app.modules.chatbot.service import local_reply


def test_local_chatbot_reports_configured_hours() -> None:
    reply = local_reply("¿Cuáles son los horarios?", "07:00", "19:00")
    assert "07:00" in reply
    assert "19:00" in reply


def test_local_chatbot_rejects_unrelated_topics() -> None:
    reply = local_reply("Explícame cálculo diferencial", "07:00", "19:00")
    assert "solo puedo orientarte" in reply


@pytest.mark.asyncio
async def test_chatbot_uses_selected_deepseek_provider(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    class FakeDatabase:
        async def get(self, model: object, item_id: int) -> None:
            return None

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {"choices": [{"message": {"content": "Respuesta de DeepSeek"}}]}

    class FakeClient:
        def __init__(self, **kwargs: object) -> None:
            pass

        async def __aenter__(self) -> "FakeClient":
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(self, url: str, **kwargs: object) -> FakeResponse:
            captured["url"] = url
            captured["json"] = kwargs["json"]
            return FakeResponse()

    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "test-key")
    monkeypatch.setattr(settings, "deepseek_model", "deepseek-flash")
    monkeypatch.setattr(service.httpx, "AsyncClient", FakeClient)

    reply, source = await service.chat(FakeDatabase(), "¿Cómo reservo?", [])  # type: ignore[arg-type]

    assert reply == "Respuesta de DeepSeek"
    assert source == "deepseek"
    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert captured["json"]["model"] == "deepseek-flash"
