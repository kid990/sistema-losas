from typing import Any

import httpx

from app.core.config import settings


async def get_usuario(codigo: str) -> dict[str, Any] | None:
    """Consulta un usuario académico por código."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{settings.unheval_api_url}/usuario/{codigo}")
            response.raise_for_status()
            raw_payload = response.json()
        if not isinstance(raw_payload, dict):
            return None
        payload: dict[str, Any] = raw_payload
        data = payload.get("data")
        if payload.get("success") and isinstance(data, dict):
            return {str(key): value for key, value in data.items()}
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    return None


async def list_usuarios() -> list[dict[str, Any]]:
    """Obtiene la vista consolidada de usuarios de la API académica."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{settings.unheval_api_url}/usuarios")
        response.raise_for_status()
        raw_payload = response.json()
    if not isinstance(raw_payload, dict):
        return []
    data = raw_payload.get("data", [])
    if not isinstance(data, list):
        return []
    return [{str(key): value for key, value in item.items()} for item in data if isinstance(item, dict)]
