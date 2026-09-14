from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import AppError


async def consultar_dni(dni: str) -> dict[str, Any]:
    """Consulta DNI usando el proveedor configurado."""
    if not settings.reniec_api_token or not settings.reniec_api_url:
        raise AppError("RENIEC API no configurada", 500)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.reniec_api_url,
                json={
                    "token": settings.reniec_api_token,
                    "type_document": "dni",
                    "document_number": dni,
                },
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise AppError("Respuesta RENIEC inválida", 502)
            return {str(key): value for key, value in payload.items()}
    except (httpx.HTTPError, ValueError) as exc:
        raise AppError("Error consultando DNI", 502) from exc
