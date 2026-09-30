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
