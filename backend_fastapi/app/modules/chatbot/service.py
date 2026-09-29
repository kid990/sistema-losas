import unicodedata
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import ConfiguracionGlobal
from app.modules.chatbot.schemas import HistoryEntry


def _plain(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.lower())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def local_reply(message: str, opening: str, closing: str) -> str:
    """Respuesta segura para preguntas frecuentes cuando Gemini no está disponible."""
    text = _plain(message)
    if any(word in text for word in ("horario", "hora", "atienden", "abren", "cierran")):
        return (
            f"El horario configurado de las losas es de {opening} a {closing}. "
            "Revisa Horarios de Atención para ver bloques disponibles."
        )
    if any(word in text for word in ("reserv", "permiso", "solicitud")):
        return (
            "Para reservar, entra a Horarios de Atención, elige una losa y un bloque. "
            "Los permisos especiales requieren un PDF de sustento."
        )
    if any(word in text for word in ("documento", "pdf", "especial", "requisito")):
        return (
            "Un permiso especial requiere un documento PDF válido de hasta 10 MB y horarios "
            "futuros sin conflictos."
        )
    if any(word in text for word in ("estado", "aprob", "rechaz", "pendiente")):
        return "Puedes consultar el estado y el detalle de tus solicitudes en la sección Mis Permisos."
    if any(word in text for word in ("deporte", "disciplina", "losa", "cancha")):
        return "Consulta Losas Deportivas para ver los espacios y disciplinas activas disponibles en SIRLOD."
    return (
        "Lo siento, solo puedo orientarte sobre reservas, requisitos, horarios y permisos "
        "de las losas deportivas de la UNHEVAL."
    )


async def chat(
    db: AsyncSession,
    message: str,
    history: list[HistoryEntry],
) -> tuple[str, str]:
    config = await db.get(ConfiguracionGlobal, 1)
    opening = config.hora_min_apertura.strftime("%H:%M") if config else "07:00"
    closing = config.hora_max_apertura.strftime("%H:%M") if config else "19:00"
    fallback = local_reply(message, opening, closing)
    if not settings.gemini_api_key:
        return fallback, "local"

    system_prompt = (
        "Eres LosaBot, asistente oficial de SIRLOD de la UNHEVAL. Responde solo sobre reservas, "
        "permisos, requisitos, horarios, disciplinas y uso de losas. Responde en español, de forma "
        f"breve y profesional. El horario configurado actual es {opening} a {closing}. "
        "Los permisos especiales requieren PDF y son evaluados con reglas de disponibilidad. "
        "No inventes estados ni reservas; remite a Mis Permisos cuando corresponda."
    )
    contents: list[dict[str, Any]] = [
        {
            "role": entry.role,
            "parts": [{"text": part.text} for part in entry.parts],
        }
        for entry in history[-10:]
    ]
    contents.append({"role": "user", "parts": [{"text": message.strip()}]})
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 250},
    }
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent"
    )
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"x-goog-api-key": settings.gemini_api_key},
            )
            response.raise_for_status()
            body = response.json()
        parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        reply = "".join(str(part.get("text", "")) for part in parts).strip()
        return (reply or fallback), ("gemini" if reply else "local")
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        return fallback, "local"


def response_payload(reply: str, source: str) -> dict[str, str]:
    return {
        "reply": reply,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }
