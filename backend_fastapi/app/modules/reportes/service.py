import asyncio
import logging
from calendar import monthrange
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import Any, Literal, cast

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AppError
from app.integrations.storage import StoredFile, delete_file, download_file, upload_file
from app.models import DetallePermiso, Losa, Permiso, ReporteGenerado
from app.modules.reportes.ai import generate_report_analysis
from app.modules.reportes.pdf import build_report_pdf, report_filename

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ReportDocument:
    content: bytes
    filename: str
    cache_hit: bool


def _stored_month(periodo: Literal["mensual", "anual"], mes: int) -> int:
    return mes if periodo == "mensual" else 0


async def _find_generated_report(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
) -> ReporteGenerado | None:
    return cast(
        ReporteGenerado | None,
        await db.scalar(
            select(ReporteGenerado).where(
                ReporteGenerado.periodo == periodo,
                ReporteGenerado.anio == anio,
                ReporteGenerado.mes == _stored_month(periodo, mes),
            )
        ),
    )


async def _cached_document(report: ReporteGenerado) -> ReportDocument:
    return ReportDocument(
        content=await download_file(report.s3_key),
        filename=report.nombre_archivo,
        cache_hit=True,
    )


async def report_status(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
) -> dict[str, Any]:
    report = await _find_generated_report(db, periodo, anio, mes)
    if not report:
        return {"existe": False}
    return {
        "existe": True,
        "id_reporte": report.id_reporte,
        "nombre_archivo": report.nombre_archivo,
        "tamanio": report.tamanio,
        "fuente_ia": report.fuente_ia,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


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
    report: dict[str, Any] = {
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
    }
    analysis, source = await generate_report_analysis(report)
    report["analisis"] = analysis.model_dump()
    report["analisis_fuente"] = source
    report["insights"] = [
        analysis.resumen_ejecutivo,
        *analysis.hallazgos,
        *analysis.recomendaciones,
    ]
    return report


async def get_or_create_pdf(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
    generado_por: int,
) -> ReportDocument:
    cached = await _find_generated_report(db, periodo, anio, mes)
    if cached:
        return await _cached_document(cached)

    content, filename, stored, source = await _generate_and_upload_pdf(
        db, periodo, anio, mes
    )
    generated = ReporteGenerado(
        periodo=periodo,
        anio=anio,
        mes=_stored_month(periodo, mes),
        nombre_archivo=filename,
        s3_key=stored.key,
        content_type="application/pdf",
        tamanio=len(content),
        sha256=sha256(content).hexdigest(),
        fuente_ia=source,
        generado_por=generado_por,
    )
    db.add(generated)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        await delete_file(stored.key)
        winner = await _find_generated_report(db, periodo, anio, mes)
        if winner:
            return await _cached_document(winner)
        raise
    except Exception:
        await db.rollback()
        await delete_file(stored.key)
        raise

    return ReportDocument(content=content, filename=filename, cache_hit=False)


async def _generate_and_upload_pdf(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
) -> tuple[bytes, str, StoredFile, str]:
    report = await summary(db, periodo, anio, mes)
    content = await asyncio.to_thread(build_report_pdf, report)
    filename = report_filename(report)
    stored = await upload_file(
        content,
        filename,
        "application/pdf",
        settings.s3_report_key_prefix,
    )
    return content, filename, stored, str(report["analisis_fuente"])


async def regenerate_pdf(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
    generado_por: int,
) -> ReportDocument:
    current = await _find_generated_report(db, periodo, anio, mes)
    old_key = current.s3_key if current else None
    content, filename, stored, source = await _generate_and_upload_pdf(
        db, periodo, anio, mes
    )

    if current:
        current.nombre_archivo = filename
        current.s3_key = stored.key
        current.content_type = "application/pdf"
        current.tamanio = len(content)
        current.sha256 = sha256(content).hexdigest()
        current.fuente_ia = source
        current.generado_por = generado_por
    else:
        db.add(
            ReporteGenerado(
                periodo=periodo,
                anio=anio,
                mes=_stored_month(periodo, mes),
                nombre_archivo=filename,
                s3_key=stored.key,
                content_type="application/pdf",
                tamanio=len(content),
                sha256=sha256(content).hexdigest(),
                fuente_ia=source,
                generado_por=generado_por,
            )
        )

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        await delete_file(stored.key)
        raise

    if old_key and old_key != stored.key:
        try:
            await delete_file(old_key)
        except Exception:
            logger.exception("No se pudo eliminar el PDF anterior de S3: %s", old_key)

    return ReportDocument(content=content, filename=filename, cache_hit=False)


async def delete_report(
    db: AsyncSession,
    periodo: Literal["mensual", "anual"],
    anio: int,
    mes: int,
) -> None:
    report = await _find_generated_report(db, periodo, anio, mes)
    if not report:
        raise AppError("El reporte seleccionado no existe", 404, "REPORT_NOT_FOUND")

    await delete_file(report.s3_key)
    await db.delete(report)
    await db.commit()
