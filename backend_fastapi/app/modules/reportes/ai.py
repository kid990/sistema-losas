import json
import logging
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)


class ReportAnalysis(BaseModel):
    resumen_ejecutivo: str = Field(
        min_length=1,
        description="Diagnóstico general ejecutivo de la gestión deportiva en el periodo.",
    )
    evaluacion_demanda: str = Field(
        default="",
        description="Evaluación cualitativa de la comunidad, disciplinas y horarios pico.",
    )
    hallazgos: list[str] = Field(
        min_length=2,
        description="Hallazgos y patrones críticos detectados.",
    )
    alertas_operativas: list[str] = Field(
        default_factory=list,
        description="Alertas preventivas de infraestructura y gestión.",
    )
    recomendaciones: list[str] = Field(
        min_length=1,
        description="Recomendaciones estratégicas priorizadas para las autoridades.",
    )
    proyeccion_tendencia: str = Field(
        default="",
        description="Estimación predictiva de la demanda esperada para el siguiente periodo.",
    )
    calificacion_eficiencia: str = Field(
        default="Nivel A - Eficiencia Operativa Conforme",
        description="Dictamen cualitativo sintetizado del desempeño operativo.",
    )


def local_analysis(report: dict[str, Any]) -> ReportAnalysis:
    courts = report.get("por_losa", [])
    total_permisos = int(report.get("total_permisos", 0))
    horas_totales = int(report.get("horas_reservadas", 0))
    tasa_aprobacion = float(report.get("tasa_aprobacion", 0.0))
    roles = report.get("por_rol", {})
    disciplines = report.get("por_disciplina", {})
    horario_pico = report.get("franja_horaria_pico", "16:00 a 19:00 hrs")

    top_losa = courts[0]["losa"] if courts else "Sin losas registradas"
    top_horas = courts[0].get("horas", 0) if courts else 0
    top_pct = round((top_horas / horas_totales * 100), 1) if horas_totales else 0.0
    less_used = courts[-1]["losa"] if len(courts) > 1 else None

    resumen = (
        f"Durante el periodo evaluado se tramitaron {total_permisos} solicitudes de reserva deportiva, "
        f"acumulando {horas_totales} horas de uso efectivo de infraestructura con una tasa de "
        f"aprobación del {tasa_aprobacion}%. La operación se caracterizó por una atención fluida "
        f"con concentración de actividad en {top_losa} ({top_pct}% del volumen total de horas)."
    )

    alumnos_cnt = roles.get("Alumno", 0)
    docentes_cnt = roles.get("Docente", 0)
    disc_text = (
        ", ".join(f"{k} ({v})" for k, v in list(disciplines.items())[:3])
        if disciplines
        else "actividades deportivas generales"
    )
    eval_demanda = (
        f"La comunidad universitaria muestra una participación liderada por el estamento estudiantil "
        f"({alumnos_cnt} reservas) y docentes ({docentes_cnt} reservas). "
        f"Las disciplinas con mayor preferencia corresponden a {disc_text}. "
        f"La franja de mayor afluencia se concentra en {horario_pico}."
    )

    hallazgos = [
        f"La tasa de aprobación se situó en {tasa_aprobacion}%, reflejando alta disponibilidad y atención sin rechazos en el periodo.",
        f"{top_losa} se posiciona como el espacio deportivo de mayor demanda institucional, concentrando {top_horas} horas reservadas ({top_pct}% del total).",
    ]
    if less_used:
        hallazgos.append(
            f"El espacio {less_used} registró menor afluencia relativa ({courts[-1].get('horas', 0)} hrs), evidenciando margen de disponibilidad para redistribución."
        )
    else:
        avg_dur = round(horas_totales / total_permisos, 1) if total_permisos else 1.0
        hallazgos.append(
            f"La duración promedio observada fue de {avg_dur} horas por sesión deportiva solicitada."
        )

    alertas = [
        f"Riesgo de sobrecarga y desgaste acelerado en {top_losa} debido a la concentración preferente de reservas vespertinas.",
    ]
    if less_used:
        alertas.append(
            f"Subutilización potencial de {less_used}, con capacidad disponible desaprovechada en horarios de alta demanda universitaria."
        )
    else:
        alertas.append("Concentración de reservas en franjas específicas, dejando turnos matutinos con bajo aprovechamiento.")

    recomendaciones = [
        f"Implementar un cronograma de mantenimiento preventivo y control de aforo en {top_losa} para garantizar la vida útil de sus instalaciones.",
        "Promover la programación de actividades y torneos formativos en las losas secundarias para equilibrar la carga deportiva.",
        "Monitorear las franjas horarias de mayor demanda para evitar solapamientos y optimizar la rotación de usuarios.",
    ]

    proyeccion = (
        f"Para el siguiente periodo se proyecta un comportamiento sostenido de la demanda deportiva. "
        f"Se estima que {top_losa} continuará absorbiendo la mayor preferencia, por lo que se recomienda incentivar el uso de espacios alternos."
    )

    calificacion = "Nivel A - Eficiencia Óptima con Concentración Moderada"

    return ReportAnalysis(
        resumen_ejecutivo=resumen,
        evaluacion_demanda=eval_demanda,
        hallazgos=hallazgos,
        alertas_operativas=alertas,
        recomendaciones=recomendaciones,
        proyeccion_tendencia=proyeccion,
        calificacion_eficiencia=calificacion,
    )


async def generate_report_analysis(report: dict[str, Any]) -> tuple[ReportAnalysis, str]:
    """Solicita a DeepSeek un análisis estratégico exhaustivo de nivel directivo."""
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
        "por_rol": report.get("por_rol", {}),
        "por_disciplina": report.get("por_disciplina", {}),
        "franja_horaria_pico": report.get("franja_horaria_pico", "16:00 a 19:00 hrs"),
    }
    system_prompt = (
        "Eres el Motor de Inteligencia Artificial Analítica de SIRLOD, sistema institucional "
        "de reservas de losas deportivas de la Universidad Nacional Hermilio Valdizán (UNHEVAL).\n"
        "Genera un análisis estratégico, riguroso y de alto impacto para la Dirección de Bienestar Universitario. "
        "Sé conciso, directo y profesional. Cada punto de las listas debe tener como máximo 35 palabras.\n"
        "Devuelve un JSON estrictamente válido con los siguientes campos:\n"
        "- resumen_ejecutivo: Diagnóstico directivo conciso (2-3 oraciones) de la gestión deportiva del periodo evaluado.\n"
        "- evaluacion_demanda: Análisis de 2 oraciones sobre comunidad, disciplinas y horarios pico.\n"
        "- hallazgos: Lista de exactamente 3 observaciones analíticas directas basadas en las cifras y patrones observados.\n"
        "- alertas_operativas: Lista de exactamente 2 alertas preventivas breves (sobrecarga o subutilización).\n"
        "- recomendaciones: Lista de exactamente 3 acciones estratégicas concretas priorizadas para las autoridades.\n"
        "- proyeccion_tendencia: Estimación predictiva de 2 oraciones para el siguiente periodo.\n"
        "- calificacion_eficiencia: Texto corto con dictamen cualitativo (ej: 'Nivel A - Eficiencia Óptima con Concentración Moderada')."
    )
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
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
                    "temperature": 0.2,
                    "max_tokens": 3000,
                    "response_format": {"type": "json_object"},
                },
                headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
            )
            response.raise_for_status()
            body = response.json()
        content = str(body["choices"][0]["message"]["content"] or "").strip()
        analysis = ReportAnalysis.model_validate(json.loads(content))
        return analysis, "deepseek"
    except Exception as exc:
        logger.warning("Fallo la llamada o procesamiento con DeepSeek AI: %s", exc)
        return fallback, "local"

