from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Query

from app.core.database import DBSession
from app.core.exceptions import AppError
from app.core.security import AuthenticatedUser
from app.modules.ml import service

router = APIRouter(prefix="/ml", tags=["Predicción de ocupación"])

MAX_DIAS = 60


@router.get("/ocupacion")
async def listar_ocupacion(
    db: DBSession,
    _user: AuthenticatedUser,
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
) -> list[dict[str, Any]]:
    hoy = date.today()
    inicio = desde or hoy
    fin = hasta or hoy + timedelta(days=14)

    if fin < inicio:
        raise AppError("El rango de fechas es inválido", 400)
    if (fin - inicio).days > MAX_DIAS:
        raise AppError(f"El rango máximo es de {MAX_DIAS} días", 400)

    return await service.list_range(db, inicio, fin)
