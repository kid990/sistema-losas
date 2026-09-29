from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query

from app.core.database import DBSession
from app.core.security import CurrentUser, require_roles
from app.modules.reportes import service

router = APIRouter(prefix="/reportes", tags=["Reportes"])
Admin = Annotated[CurrentUser, Depends(require_roles("Administrador"))]


@router.get("/resumen")
async def report_summary(
    db: DBSession,
    _admin: Admin,
    periodo: Literal["mensual", "anual"] = Query(default="mensual"),
    anio: int = Query(default_factory=lambda: date.today().year, ge=2020, le=2100),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
) -> dict[str, Any]:
    return {"success": True, "data": await service.summary(db, periodo, anio, mes)}
