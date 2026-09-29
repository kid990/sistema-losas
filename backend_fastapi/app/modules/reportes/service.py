from calendar import monthrange
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DetallePermiso, Losa, Permiso


def period_bounds(periodo: Literal["mensual", "anual"], anio: int, mes: int) -> tuple[datetime, datetime]:
    start = datetime(anio, mes if periodo == "mensual" else 1, 1)
    if periodo == "mensual":
        last_day = monthrange(anio, mes)[1]
        end = datetime(anio, mes, last_day, 23, 59, 59, 999999)
    else:
        end = datetime(anio, 12, 31, 23, 59, 59, 999999)
    return start, end


async def summary(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
) -> dict[str, Any]:
    start, end = period_bounds(periodo, anio, mes)
    period_filter = (Permiso.fecha_creacion >= start, Permiso.fecha_creacion <= end)
    statuses = {
        str(status): int(total)
        for status, total in (
            await db.execute(
                select(Permiso.estado, func.count(Permiso.id_p))
                .where(*period_filter)
                .group_by(Permiso.estado)
            )
        ).all()
    }
    types = {
        str(permission_type): int(total)
        for permission_type, total in (
            await db.execute(
                select(Permiso.tipo, func.count(Permiso.id_p))
                .where(*period_filter)
                .group_by(Permiso.tipo)
            )
        ).all()
    }
    total = sum(statuses.values())
    accepted = statuses.get("Aceptado", 0)
    hours = await db.scalar(
        select(func.coalesce(func.sum(DetallePermiso.duracion), 0))
        .join(Permiso, Permiso.id_p == DetallePermiso.id_p)
        .where(*period_filter, Permiso.estado == "Aceptado")
    )
    courts = [
        {"losa": name, "reservas": int(count), "horas": int(court_hours or 0)}
        for name, count, court_hours in (
            await db.execute(
                select(
                    Losa.nombre,
                    func.count(func.distinct(Permiso.id_p)),
                    func.coalesce(func.sum(DetallePermiso.duracion), 0),
                )
                .join(DetallePermiso, DetallePermiso.id_l == Losa.id_l)
                .join(Permiso, Permiso.id_p == DetallePermiso.id_p)
                .where(*period_filter, Permiso.estado == "Aceptado")
                .group_by(Losa.id_l, Losa.nombre)
                .order_by(func.count(func.distinct(Permiso.id_p)).desc(), Losa.nombre)
            )
        ).all()
    ]
    approval_rate = round((accepted / total * 100), 1) if total else 0.0
    insights = [
        f"La tasa de aprobación del periodo es {approval_rate}%.",
        (
            f"La losa con mayor uso es {courts[0]['losa']} con {courts[0]['reservas']} reservas."
            if courts
            else "No hay reservas aceptadas en el periodo seleccionado."
        ),
        f"Se registraron {types.get('Especial', 0)} permisos especiales y {types.get('Normal', 0)} normales.",
    ]
    return {
        "periodo": periodo,
        "anio": anio,
        "mes": mes if periodo == "mensual" else None,
        "desde": start.date(),
        "hasta": end.date(),
        "total_permisos": total,
        "horas_reservadas": int(hours or 0),
        "tasa_aprobacion": approval_rate,
        "por_estado": statuses,
        "por_tipo": types,
        "por_losa": courts,
        "insights": insights,
    }
