from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

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


@router.get("/estado")
async def generated_report_status(
    db: DBSession,
    _admin: Admin,
    periodo: Literal["mensual", "anual"] = Query(default="mensual"),
    anio: int = Query(default_factory=lambda: date.today().year, ge=2020, le=2100),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
) -> dict[str, Any]:
    return {
        "success": True,
        "data": await service.report_status(db, periodo, anio, mes),
    }


@router.get("/pdf", response_class=Response)
async def report_pdf(
    db: DBSession,
    admin: Admin,
    periodo: Literal["mensual", "anual"] = Query(default="mensual"),
    anio: int = Query(default_factory=lambda: date.today().year, ge=2020, le=2100),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    descargar: bool = Query(default=False),
) -> Response:
    document = await service.get_or_create_pdf(db, periodo, anio, mes, admin.id)
    disposition = "attachment" if descargar else "inline"
    return Response(
        content=document.content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{document.filename}"',
            "Cache-Control": "private, no-store",
            "X-Report-Cache": "HIT" if document.cache_hit else "MISS",
        },
    )


@router.post("/regenerar")
async def regenerate_report(
    db: DBSession,
    admin: Admin,
    periodo: Literal["mensual", "anual"] = Query(default="mensual"),
    anio: int = Query(default_factory=lambda: date.today().year, ge=2020, le=2100),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
) -> dict[str, Any]:
    document = await service.regenerate_pdf(db, periodo, anio, mes, admin.id)
    return {
        "success": True,
        "message": "Reporte regenerado correctamente",
        "data": {"nombre_archivo": document.filename},
    }


@router.delete("")
async def delete_generated_report(
    db: DBSession,
    _admin: Admin,
    periodo: Literal["mensual", "anual"] = Query(default="mensual"),
    anio: int = Query(default_factory=lambda: date.today().year, ge=2020, le=2100),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
) -> dict[str, Any]:
    await service.delete_report(db, periodo, anio, mes)
    return {"success": True, "message": "Reporte eliminado correctamente"}
