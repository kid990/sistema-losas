import json
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings


class ReportAnalysis(BaseModel):
    resumen_ejecutivo: str = Field(min_length=1, max_length=800)
    hallazgos: list[str] = Field(min_length=2, max_length=4)
    recomendaciones: list[str] = Field(min_length=1, max_length=3)


def local_analysis(report: dict[str, Any]) -> ReportAnalysis:
    courts = report.get("por_losa", [])
    most_used = (
        f"La losa con mayor uso es {courts[0]['losa']} con {courts[0]['reservas']} reservas "
        f"y {courts[0]['horas']} horas."
        if courts
        else "No hay reservas aceptadas en el periodo seleccionado."
    )
    return ReportAnalysis(
        resumen_ejecutivo=(
            f"Durante el periodo se registraron {report['total_permisos']} permisos, "
            f"{report['horas_reservadas']} horas reservadas y una tasa de aprobación de "
            f"{report['tasa_aprobacion']}%."
        ),
        hallazgos=[
            most_used,
            f"Se registraron {report['por_tipo'].get('Especial', 0)} permisos especiales y "
            f"{report['por_tipo'].get('Normal', 0)} normales.",
        ],
        recomendaciones=[
            "Revisar periódicamente la demanda por losa y ajustar la disponibilidad según el uso."
        ],
    )


async def generate_report_analysis(report: dict[str, Any]) -> tuple[ReportAnalysis, str]:
    """Solicita a DeepSeek una interpretación basada solo en estadísticas agregadas."""
    fallback = local_analysis(report)
    if settings.ai_provider != "deepseek" or not settings.deepseek_api_key:
        return fallback, "local"

    aggregate_data = {
        "periodo": report["periodo"],
        "anio": report["anio"],
        "mes": report.get("mes"),
        "desde": str(report["desde"]),
        "hasta": str(report["hasta"]),
        "total_permisos": report["total_permisos"],
        "horas_reservadas": report["horas_reservadas"],
        "tasa_aprobacion": report["tasa_aprobacion"],
        "por_estado": report["por_estado"],
        "por_tipo": report["por_tipo"],
        "por_losa": report["por_losa"],
    }
    system_prompt = (
        "Eres un analista administrativo de SIRLOD, sistema de reservas de losas deportivas de "
        "la UNHEVAL. Analiza exclusivamente las estadísticas agregadas proporcionadas. No inventes "
        "cifras, causas, personas ni hechos. Redacta en español profesional, claro y breve. "
        "Devuelve JSON válido con: resumen_ejecutivo (texto), hallazgos (2 a 4 textos) y "
        "recomendaciones (1 a 3 textos). Las recomendaciones deben derivarse de los datos."
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.deepseek_base_url.rstrip('/')}/chat/completions",
                json={
                    "model": settings.deepseek_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": json.dumps(aggregate_data, ensure_ascii=False),
                        },
                    ],
                    "thinking": {"type": "disabled"},
                    "temperature": 0,
                    "max_tokens": 700,
                    "response_format": {"type": "json_object"},
                },
                headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
            )
            response.raise_for_status()
            body = response.json()
        content = str(body["choices"][0]["message"]["content"] or "").strip()
        analysis = ReportAnalysis.model_validate(json.loads(content))
        return analysis, "deepseek"
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, ValidationError):
        return fallback, "local"
