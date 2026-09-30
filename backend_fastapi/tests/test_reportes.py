from datetime import datetime
from io import BytesIO
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.storage import StoredFile
from app.modules.reportes import ai, service
from app.modules.reportes.ai import generate_report_analysis
from app.modules.reportes.pdf import build_report_pdf, report_filename
from app.modules.reportes.service import period_bounds


def test_monthly_period_bounds_include_leap_day() -> None:
    start, end = period_bounds("mensual", 2028, 2)
    assert start == datetime(2028, 2, 1)
    assert end.date().isoformat() == "2028-02-29"


def test_annual_period_bounds_cover_full_year() -> None:
    start, end = period_bounds("anual", 2026, 9)
    assert start.date().isoformat() == "2026-01-01"
    assert end.date().isoformat() == "2026-12-31"


def test_report_pdf_is_valid_and_contains_summary() -> None:
    report = {
        "periodo": "mensual",
        "anio": 2026,
        "mes": 9,
        "desde": "2026-09-01",
        "hasta": "2026-09-30",
        "total_permisos": 12,
        "horas_reservadas": 18,
        "tasa_aprobacion": 75.0,
        "por_estado": {"Aceptado": 9, "Pendiente": 3},
        "por_tipo": {"Normal": 8, "Especial": 4},
        "por_losa": [{"losa": "Losa Principal", "reservas": 9, "horas": 18}],
        "analisis_fuente": "deepseek",
        "analisis": {
            "resumen_ejecutivo": "El periodo registra una aprobación favorable.",
            "hallazgos": ["La Losa Principal concentra el uso.", "Predominan permisos aceptados."],
            "recomendaciones": ["Mantener el seguimiento mensual."],
        },
        "insights": ["La tasa de aprobación del periodo es 75.0%."],
    }

    content = build_report_pdf(report)
    reader = PdfReader(BytesIO(content))
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)

    assert content.startswith(b"%PDF-")
    assert len(reader.pages) == 1
    assert "Reporte de permisos" in extracted
    assert "Losa Principal" in extracted
    assert "DeepSeek" in extracted
    assert report_filename(report) == "reporte_mensual_2026_09.pdf"


@pytest.mark.asyncio
async def test_report_analysis_uses_deepseek(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": (
                                '{"resumen_ejecutivo":"Resumen IA",'
                                '"hallazgos":["Hallazgo uno","Hallazgo dos"],'
                                '"recomendaciones":["Recomendación uno"]}'
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
            return FakeResponse()

    monkeypatch.setattr(settings, "ai_provider", "deepseek")
    monkeypatch.setattr(settings, "deepseek_api_key", "test-key")
    monkeypatch.setattr(ai.httpx, "AsyncClient", FakeClient)
    report = {
        "periodo": "mensual",
        "anio": 2026,
        "mes": 9,
        "desde": "2026-09-01",
        "hasta": "2026-09-30",
        "total_permisos": 3,
        "horas_reservadas": 4,
        "tasa_aprobacion": 66.7,
        "por_estado": {"Aceptado": 2, "Pendiente": 1},
        "por_tipo": {"Normal": 2, "Especial": 1},
        "por_losa": [{"losa": "Losa 01", "reservas": 2, "horas": 4}],
    }

    analysis, source = await generate_report_analysis(report)

    assert source == "deepseek"
    assert analysis.resumen_ejecutivo == "Resumen IA"
    assert captured["url"] == "https://api.deepseek.com/chat/completions"
    assert captured["json"]["response_format"] == {"type": "json_object"}


@pytest.mark.asyncio
async def test_generated_report_is_loaded_from_s3_cache(monkeypatch) -> None:
    db = AsyncMock(spec=AsyncSession)
    cached = SimpleNamespace(
        s3_key="reportes/existente.pdf",
        nombre_archivo="reporte_mensual_2026_07.pdf",
    )
    find_report = AsyncMock(return_value=cached)
    download = AsyncMock(return_value=b"%PDF-cache")
    generate_summary = AsyncMock()
    monkeypatch.setattr(service, "_find_generated_report", find_report)
    monkeypatch.setattr(service, "download_file", download)
    monkeypatch.setattr(service, "summary", generate_summary)

    document = await service.get_or_create_pdf(db, "mensual", 2026, 7, 1)

    assert document.content == b"%PDF-cache"
    assert document.cache_hit is True
    download.assert_awaited_once_with("reportes/existente.pdf")
    generate_summary.assert_not_awaited()


@pytest.mark.asyncio
async def test_new_report_is_uploaded_to_reports_prefix_and_registered(monkeypatch) -> None:
    db = AsyncMock(spec=AsyncSession)
    db.add = MagicMock()
    find_report = AsyncMock(return_value=None)
    upload = AsyncMock(
        return_value=StoredFile(
            url="https://bucket.example/reportes/nuevo.pdf",
            key="reportes/nuevo.pdf",
        )
    )
    monkeypatch.setattr(service, "_find_generated_report", find_report)
    monkeypatch.setattr(
        service,
        "summary",
        AsyncMock(return_value={"analisis_fuente": "deepseek"}),
    )
    monkeypatch.setattr(service, "build_report_pdf", lambda _report: b"%PDF-nuevo")
    monkeypatch.setattr(service, "report_filename", lambda _report: "reporte_mensual_2026_07.pdf")
    monkeypatch.setattr(service, "upload_file", upload)
    monkeypatch.setattr(settings, "s3_report_key_prefix", "reportes")

    document = await service.get_or_create_pdf(db, "mensual", 2026, 7, 9)

    assert document.content == b"%PDF-nuevo"
    assert document.cache_hit is False
    upload.assert_awaited_once_with(
        b"%PDF-nuevo",
        "reporte_mensual_2026_07.pdf",
        "application/pdf",
        "reportes",
    )
    generated = db.add.call_args.args[0]
    assert generated.s3_key == "reportes/nuevo.pdf"
    assert generated.generado_por == 9
    assert generated.mes == 7
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_regenerate_replaces_s3_object_and_keeps_period_record(monkeypatch) -> None:
    db = AsyncMock(spec=AsyncSession)
    current = SimpleNamespace(
        nombre_archivo="anterior.pdf",
        s3_key="reportes/anterior.pdf",
        content_type="application/pdf",
        tamanio=100,
        sha256="a" * 64,
        fuente_ia="deepseek",
        generado_por=1,
    )
    monkeypatch.setattr(service, "_find_generated_report", AsyncMock(return_value=current))
    monkeypatch.setattr(
        service,
        "_generate_and_upload_pdf",
        AsyncMock(
            return_value=(
                b"%PDF-regenerado",
                "reporte_mensual_2026_07.pdf",
                StoredFile(
                    url="https://bucket.example/reportes/nuevo.pdf",
                    key="reportes/nuevo.pdf",
                ),
                "deepseek",
            )
        ),
    )
    delete = AsyncMock()
    monkeypatch.setattr(service, "delete_file", delete)

    document = await service.regenerate_pdf(db, "mensual", 2026, 7, 9)

    assert document.content == b"%PDF-regenerado"
    assert current.s3_key == "reportes/nuevo.pdf"
    assert current.generado_por == 9
    db.commit.assert_awaited_once()
    delete.assert_awaited_once_with("reportes/anterior.pdf")


@pytest.mark.asyncio
async def test_delete_report_removes_s3_object_and_database_record(monkeypatch) -> None:
    db = AsyncMock(spec=AsyncSession)
    current = SimpleNamespace(s3_key="reportes/reporte.pdf")
    monkeypatch.setattr(service, "_find_generated_report", AsyncMock(return_value=current))
    delete = AsyncMock()
    monkeypatch.setattr(service, "delete_file", delete)

    await service.delete_report(db, "anual", 2026, 9)

    delete.assert_awaited_once_with("reportes/reporte.pdf")
    db.delete.assert_awaited_once_with(current)
    db.commit.assert_awaited_once()
