import pytest

from app.core.config import settings
from app.modules.permisos.document_review import DocumentAssessment, rejection_reasons


def assessment(**overrides: object) -> DocumentAssessment:
    values: dict[str, object] = {
        "readable": True,
        "mentions_unheval": True,
        "student_identity_matches": True,
        "allowed_category": "campeonato_estudiantil",
        "activity_organized_by_students": True,
        "has_visible_signature": True,
        "schedule_matches": True,
        "confidence": 0.95,
        "summary": "Campeonato estudiantil UNHEVAL firmado y con horario coincidente.",
    }
    values.update(overrides)
    return DocumentAssessment.model_validate(values)


def test_accepts_signed_student_championship() -> None:
    assert rejection_reasons(assessment()) == []


def test_anniversary_does_not_require_student_organization() -> None:
    result = assessment(
        allowed_category="aniversario_facultad",
        activity_organized_by_students=False,
    )
    assert rejection_reasons(result) == []


def test_rejects_unsigned_or_non_allowed_activity() -> None:
    reasons = rejection_reasons(
        assessment(
            allowed_category="no_permitida",
            has_visible_signature=False,
        )
    )
    assert "La actividad no pertenece a una categoría especial permitida" in reasons
    assert "El documento no contiene una firma visible" in reasons


def test_rejects_identity_mismatch_and_low_confidence(monkeypatch) -> None:
    monkeypatch.setattr(settings, "document_ai_min_confidence", 0.85)
    reasons = rejection_reasons(
        assessment(
            student_identity_matches=False,
            confidence=0.60,
        )
    )
    assert "La identidad o código del estudiante no coincide con el solicitante" in reasons
    assert "La confianza del análisis documental es insuficiente" in reasons


@pytest.mark.asyncio
async def test_analyze_document_uses_openai(monkeypatch) -> None:
    import json
    from typing import Any
    from app.modules.permisos.document_review import analyze_document

    captured: dict[str, Any] = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "readable": True,
                                    "mentions_unheval": True,
                                    "student_identity_matches": True,
                                    "allowed_category": "campeonato_estudiantil",
                                    "activity_organized_by_students": True,
                                    "has_visible_signature": True,
                                    "schedule_matches": True,
                                    "confidence": 0.95,
                                    "summary": "Documento validado con ChatGPT OpenAI.",
                                }
                            )
                        }
                    }
                ]
            }

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
            captured["headers"] = kwargs.get("headers")
            return FakeResponse()

    monkeypatch.setattr(settings, "document_ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "sk-openai-doc-key")
    monkeypatch.setattr(settings, "document_ai_model", "gpt-4o-mini")
    monkeypatch.setattr("app.modules.permisos.document_review.httpx.AsyncClient", FakeClient)

    result = await analyze_document(
        b"%PDF-1.4 test dummy pdf content",
        student={"codigo": "2020123456", "nombre_completo": "Juan Perez"},
        requested_schedule="2026-10-15 10:00 - 12:00",
    )

    assert result.readable is True
    assert result.allowed_category == "campeonato_estudiantil"
    assert result.summary == "Documento validado con ChatGPT OpenAI."
    assert captured["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured["json"]["model"] == "gpt-4o-mini"
    assert captured["headers"] == {"Authorization": "Bearer sk-openai-doc-key"}
