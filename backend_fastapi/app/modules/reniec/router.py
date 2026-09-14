from typing import Any

from fastapi import APIRouter

from app.core.exceptions import AppError
from app.integrations.reniec import consultar_dni as consultar_dni_service

router = APIRouter(prefix="/reniec", tags=["RENIEC"])


@router.get("/{dni}")
async def consultar_dni(dni: str) -> dict[str, Any]:
    if len(dni) != 8 or not dni.isdigit():
        raise AppError("DNI inválido", 400)
    return await consultar_dni_service(dni)
