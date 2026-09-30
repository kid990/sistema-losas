from contextlib import suppress
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.serialization import model_dict
from app.integrations.email import send_email
from app.integrations.storage import (
    delete_file,
    download_file,
    object_key,
    signed_download_url,
    upload_file,
)
from app.integrations.unheval import get_usuario, list_usuarios
from app.models import (
    Archivo,
    ConfiguracionGlobal,
    DetallePermiso,
    DiaBloqueado,
    Disciplina,
    Losa,
    Notificacion,
    Permiso,
    Trabajador,
    User,
)
from app.modules.permisos.document_review import analyze_document, rejection_reasons
from app.modules.permisos.schemas import DetallePermisoIn, PermisoIn, PermisoTrabajadorIn


def _utc_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def _validate_details(
    db: AsyncSession,
    details: list[DetallePermisoIn],
    *,
    enforce_request_window: bool,
) -> ConfiguracionGlobal:
    config = await db.get(ConfiguracionGlobal, 1)
    if config is None:
        config = ConfiguracionGlobal(
            id=1,
            hora_min_solicitud=time(7),
            hora_max_solicitud=time(19),
            hora_min_apertura=time(7),
            hora_max_apertura=time(19),
            restriccion_hoy=time(9),
            max_horas_semana=Decimal("3.00"),
        )
        db.add(config)
        await db.flush()

    now = datetime.now().time()
    if enforce_request_window and not (config.hora_min_solicitud <= now <= config.hora_max_solicitud):
        raise AppError(
            "Las solicitudes solo se reciben entre "
            f"{config.hora_min_solicitud.strftime('%H:%M')} y "
            f"{config.hora_max_solicitud.strftime('%H:%M')}",
            400,
            "REQUEST_WINDOW_CLOSED",
            {
                "hora_inicio": config.hora_min_solicitud.strftime("%H:%M"),
                "hora_fin": config.hora_max_solicitud.strftime("%H:%M"),
            },
        )

    blocked = {
        item.fecha: item.motivo
        for item in (
            await db.scalars(
                select(DiaBloqueado).where(DiaBloqueado.fecha.in_({item.fecha for item in details}))
            )
        ).all()
    }
    for detail in details:
        if detail.fecha < date.today():
            raise AppError("No se pueden reservar fechas pasadas", 400, "PAST_DATE")
        if detail.fecha in blocked:
            raise AppError(
                f"No se permiten solicitudes para {detail.fecha.isoformat()}: {blocked[detail.fecha]}",
                400,
                "BLOCKED_DATE",
                {"fecha": detail.fecha.isoformat(), "motivo": blocked[detail.fecha]},
            )
        if detail.hora_inicio < config.hora_min_apertura or detail.hora_fin > config.hora_max_apertura:
            raise AppError(
                "El horario debe estar dentro de la apertura configurada: "
                f"{config.hora_min_apertura.strftime('%H:%M')} a "
                f"{config.hora_max_apertura.strftime('%H:%M')}",
                400,
                "OUTSIDE_OPENING_HOURS",
                {
                    "hora_apertura": config.hora_min_apertura.strftime("%H:%M"),
                    "hora_cierre": config.hora_max_apertura.strftime("%H:%M"),
                },
            )

    ordered = sorted(details, key=lambda item: (item.id_l, item.fecha, item.hora_inicio))
    for previous, current in zip(ordered, ordered[1:], strict=False):
        if (
            previous.id_l == current.id_l
            and previous.fecha == current.fecha
            and current.hora_inicio < previous.hora_fin
        ):
            raise AppError(
                "La solicitud contiene bloques horarios que se cruzan entre sí",
                400,
                "OVERLAPPING_REQUEST_BLOCKS",
                {
                    "primer_bloque": previous.model_dump(mode="json"),
                    "segundo_bloque": current.model_dump(mode="json"),
                },
            )
    return config


async def _check_group_restriction(
    db: AsyncSession, user_id: int, details: list[DetallePermisoIn], config: ConfiguracionGlobal
) -> None:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("Usuario no encontrado", 404, "USER_NOT_FOUND")
    external = await get_usuario(user.codigo)
    if not external:
        raise AppError(
            "No se pudo verificar al usuario en la API UNHEVAL",
            502,
            "ACADEMIC_VALIDATION_UNAVAILABLE",
        )
    if external.get("rol") != "Alumno":
        return
    academic_year, school = external.get("año_academico"), external.get("escuela")
    if not academic_year or not school:
        raise AppError(
            "Faltan el año académico o la escuela del alumno",
            400,
            "ACADEMIC_DATA_MISSING",
        )
    try:
        group = [
            item
            for item in await list_usuarios()
            if item.get("rol") == "Alumno"
            and item.get("año_academico") == academic_year
            and item.get("escuela") == school
        ]
    except Exception as exc:
        raise AppError(
            "No se pudo verificar las restricciones académicas en la API UNHEVAL",
            502,
            "ACADEMIC_VALIDATION_UNAVAILABLE",
        ) from exc
    if not group:
        return
    codes = [str(item["codigo"]) for item in group if item.get("codigo")]
    ids = list((await db.scalars(select(User.id_u).where(User.codigo.in_(codes)))).all())
    if not ids:
        return
    await db.execute(
        select(User.id_u).where(User.id_u.in_(ids)).order_by(User.id_u).with_for_update()
    )
    max_hours = config.max_horas_semana
    restriction_time = config.restriccion_hoy
    requested_date = min(item.fecha for item in details)
    week_start_date = requested_date - timedelta(days=requested_date.weekday())
    week_end_date = week_start_date + timedelta(days=7)
    common = (
        Permiso.id_u.in_(ids),
        Permiso.tipo == "Normal",
        Permiso.estado == "Aceptado",
    )
    today_count = await db.scalar(
        select(func.count(func.distinct(Permiso.id_p)))
        .join(DetallePermiso, DetallePermiso.id_p == Permiso.id_p)
        .where(*common, DetallePermiso.fecha == requested_date)
    )
    if today_count:
        raise AppError(
            f"No se puede reservar: el grupo de {school}, año {academic_year}, "
            f"ya tiene un permiso normal aceptado para {requested_date.isoformat()}",
            400,
            "GROUP_DAILY_LIMIT",
            {
                "escuela": school,
                "año_academico": academic_year,
                "fecha": requested_date.isoformat(),
                "max_permisos_dia": 1,
            },
        )
    weekly_hours = await db.scalar(
        select(func.coalesce(func.sum(DetallePermiso.duracion), 0))
        .join(Permiso, Permiso.id_p == DetallePermiso.id_p)
        .where(
            *common,
            DetallePermiso.fecha >= week_start_date,
            DetallePermiso.fecha < week_end_date,
        )
    )
    requested_hours = Decimal(sum(item.duracion for item in details))
    used_hours = Decimal(str(weekly_hours or 0))
    if used_hours + requested_hours > max_hours:
        raise AppError(
            f"No se puede reservar: el grupo de {school}, año {academic_year}, tiene "
            f"{used_hours} de {max_hours} horas usadas esta semana y solicita {requested_hours} más",
            400,
            "GROUP_WEEKLY_LIMIT",
            {
                "escuela": school,
                "año_academico": academic_year,
                "horas_usadas": used_hours,
                "horas_solicitadas": requested_hours,
                "limite_semanal": max_hours,
                "semana_inicio": week_start_date.isoformat(),
                "semana_fin": week_end_date.isoformat(),
            },
        )
    previous_count = await db.scalar(
        select(func.count(func.distinct(Permiso.id_p)))
        .join(DetallePermiso, DetallePermiso.id_p == Permiso.id_p)
        .where(
            *common,
            DetallePermiso.fecha >= week_start_date,
            DetallePermiso.fecha < requested_date,
        )
    )
    if previous_count and datetime.now().time() < restriction_time:
        raise AppError(
            f"No se puede reservar: el grupo de {school}, año {academic_year}, ya tuvo permisos "
            "esta semana y solo puede volver a solicitar después de las "
            f"{restriction_time.strftime('%H:%M')}",
            400,
            "GROUP_REQUEST_TIME_RESTRICTION",
            {
                "escuela": school,
                "año_academico": academic_year,
                "hora_permitida": restriction_time.strftime("%H:%M"),
                "hora_actual": datetime.now().strftime("%H:%M"),
            },
        )


async def _conflicts(
    db: AsyncSession,
    details: list[DetallePermisoIn],
    *,
    exclude_permission_id: int | None = None,
) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    courts: dict[int, tuple[Losa, str]] = {}
    for court_id in sorted({item.id_l for item in details}):
        row = (
            await db.execute(
                select(Losa, Disciplina.estado)
                .join(Disciplina, Losa.id_d == Disciplina.id_d)
                .where(Losa.id_l == court_id)
                .with_for_update()
            )
        ).one_or_none()
        if row:
            courts[court_id] = (row[0], row[1])

    for detail in details:
        court_data = courts.get(detail.id_l)
        detail_data = detail.model_dump(mode="json")
        if court_data is None:
            conflicts.append({"detalle": detail_data, "error": "Losa no encontrada"})
            continue
        court, discipline_status = court_data
        if court.estado != "Disponible":
            conflicts.append(
                {
                    "detalle": detail_data,
                    "error": f'La losa "{court.nombre}" no está disponible (estado: {court.estado})',
                }
            )
            continue
        if discipline_status != "Activo":
            conflicts.append({"detalle": detail_data, "error": "La disciplina de la losa está inactiva"})
            continue
        stmt = (
            select(DetallePermiso)
            .join(Permiso, DetallePermiso.id_p == Permiso.id_p)
            .where(
                DetallePermiso.id_l == detail.id_l,
                DetallePermiso.fecha == detail.fecha,
                Permiso.estado.in_(("Pendiente", "Aceptado")),
                DetallePermiso.hora_inicio < detail.hora_fin,
                DetallePermiso.hora_fin > detail.hora_inicio,
            )
            .limit(1)
        )
        if exclude_permission_id is not None:
            stmt = stmt.where(Permiso.id_p != exclude_permission_id)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            conflicts.append(
                {
                    "detalle": detail_data,
                    "error": f'La losa "{court.nombre}" ya tiene una reserva entre '
                    f"{detail.hora_inicio.strftime('%H:%M')} y {detail.hora_fin.strftime('%H:%M')} "
                    f"el {detail.fecha.isoformat()}",
                    "conflictos": [model_dict(existing)],
                }
            )
    return conflicts


async def _document_policy_reasons(
    db: AsyncSession,
    permission: Permiso,
    details: list[DetallePermisoIn],
) -> tuple[list[str], str | None]:
    """Valida padrón UNHEVAL y contenido del sustento de un permiso especial."""
    if permission.id_u is None:
        return ["El permiso especial no fue solicitado por un estudiante UNHEVAL"], None
    user = await db.get(User, permission.id_u)
    if user is None or user.estado != "Activo" or user.rol != "Alumno":
        return ["El solicitante no es un estudiante UNHEVAL activo"], None

    student = await get_usuario(user.codigo)
    if student is None or student.get("rol") != "Alumno":
        return ["No se pudo acreditar al solicitante como estudiante en el padrón UNHEVAL"], None
    if str(student.get("codigo") or "") != user.codigo:
        return ["El código del padrón UNHEVAL no coincide con el solicitante"], None

    if permission.id_arch is None:
        return ["No tiene documento PDF de sustento"], None
    archive = await db.get(Archivo, permission.id_arch)
    if archive is None:
        return ["El documento de sustento no se encuentra almacenado"], None
    if archive.mimetype != "application/pdf" or not archive.nombre_original.lower().endswith(".pdf"):
        return ["El sustento almacenado no es un PDF válido"], None

    key = object_key(archive.nombre_unico) or object_key(archive.url)
    if key is None:
        return ["No se pudo localizar el documento en el almacenamiento privado"], None

    court_rows = (
        await db.execute(select(Losa.id_l, Losa.nombre).where(Losa.id_l.in_({item.id_l for item in details})))
    ).all()
    court_names = {int(row.id_l): str(row.nombre) for row in court_rows}
    requested_schedule = "\n".join(
        f"- {item.fecha.isoformat()} de {item.hora_inicio.strftime('%H:%M')} "
        f"a {item.hora_fin.strftime('%H:%M')} en {court_names.get(item.id_l, f'Losa {item.id_l}') }"
        for item in details
    )
    try:
        content = await download_file(key)
        if not content.startswith(b"%PDF-"):
            return ["El contenido almacenado no corresponde a un PDF válido"], None
        assessment = await analyze_document(
            content,
            student=student,
            requested_schedule=requested_schedule,
        )
    except (AppError, RuntimeError):
        return ["No se pudo verificar el contenido del documento con la IA"], None
    return rejection_reasons(assessment), assessment.summary


async def automatic_review(db: AsyncSession, worker_id: int) -> dict[str, Any]:
    """Evalúa permisos especiales pendientes con reglas deterministas y auditables."""
    decision_worker = await db.get(Trabajador, worker_id)
    if decision_worker is None or decision_worker.estado != "Activo":
        raise AppError("Administrador revisor no encontrado o inactivo", 403)
    permissions = list(
        (
            await db.scalars(
                select(Permiso)
                .where(Permiso.tipo == "Especial", Permiso.estado == "Pendiente")
                .order_by(Permiso.fecha_creacion, Permiso.id_p)
                .with_for_update()
            )
        ).all()
    )
    results: list[dict[str, Any]] = []
    for permission in permissions:
        reasons: list[str] = []
        document_summary: str | None = None
        stored_details = list(
            (await db.scalars(select(DetallePermiso).where(DetallePermiso.id_p == permission.id_p))).all()
        )
        details = [
            DetallePermisoIn(
                id_l=item.id_l,
                fecha=item.fecha,
                hora_inicio=item.hora_inicio,
                hora_fin=item.hora_fin,
                duracion=item.duracion,
            )
            for item in stored_details
        ]
        if not details:
            reasons.append("No contiene bloques horarios")
        if details:
            try:
                await _validate_details(db, details, enforce_request_window=False)
            except AppError as exc:
                reasons.append(exc.message)
            conflicts = await _conflicts(db, details, exclude_permission_id=permission.id_p)
            accepted_conflicts = []
            for conflict in conflicts:
                conflict_id = (conflict.get("conflictos") or [{}])[0].get("id_p")
                if conflict_id:
                    existing_status = await db.scalar(
                        select(Permiso.estado).where(Permiso.id_p == int(conflict_id))
                    )
                    if existing_status == "Aceptado":
                        accepted_conflicts.append(conflict)
                else:
                    accepted_conflicts.append(conflict)
            if accepted_conflicts:
                reasons.append("Uno o más bloques tienen conflicto con una reserva aceptada")
            document_reasons, document_summary = await _document_policy_reasons(
                db,
                permission,
                details,
            )
            reasons.extend(document_reasons)
        new_status = "Rechazado" if reasons else "Aceptado"
        reason = (
            "; ".join(dict.fromkeys(reasons))
            if reasons
            else f"Cumple todas las reglas automáticas. {document_summary or ''}".strip()
        )
        permission.estado = new_status
        permission.id_t_decision = worker_id
        permission.fecha_decision = _utc_naive()
        db.add(
            Notificacion(
                mensaje=f"Revisión automática: {new_status}. {reason}",
                tipo=new_status,
                id_p=permission.id_p,
                leido=False,
            )
        )
        await db.flush()
        results.append({"id_p": permission.id_p, "decision": new_status, "motivo": reason})
    await db.commit()
    return {
        "procesados": len(results),
        "aceptados": sum(item["decision"] == "Aceptado" for item in results),
        "rechazados": sum(item["decision"] == "Rechazado" for item in results),
        "resultados": results,
    }


async def _create_details(db: AsyncSession, permission_id: int, details: list[DetallePermisoIn]) -> None:
    db.add_all([DetallePermiso(id_p=permission_id, **detail.model_dump()) for detail in details])


async def create_user_permission(
    db: AsyncSession, payload: PermisoIn, user_id: int, document: UploadFile | None
) -> dict[str, Any]:
    config = await _validate_details(db, payload.detalles, enforce_request_window=True)
    if payload.tipo == "Normal":
        await _check_group_restriction(db, user_id, payload.detalles, config)
    conflicts = await _conflicts(db, payload.detalles)
    if conflicts:
        raise AppError(
            "No se puede reservar porque uno o más horarios ya están ocupados o no están disponibles",
            409,
            "SCHEDULE_CONFLICT",
            conflicts=conflicts,
        )

    archive_id: int | None = None
    uploaded_key: str | None = None
    if payload.tipo == "Especial":
        if document is None:
            raise AppError("El documento es obligatorio para permisos especiales", 400)
        if document.content_type != "application/pdf" or not (
            document.filename or ""
        ).lower().endswith(".pdf"):
            raise AppError("Solo se permiten archivos PDF", 400, "INVALID_FILE_TYPE")
        content = await document.read(10 * 1024 * 1024 + 1)
        if not content:
            raise AppError("El documento PDF está vacío", 400, "EMPTY_FILE")
        if len(content) > 10 * 1024 * 1024:
            raise AppError("El archivo no debe superar 10 MB", 413, "FILE_TOO_LARGE")
        if not content.startswith(b"%PDF-"):
            raise AppError("El contenido del archivo no corresponde a un PDF", 400, "INVALID_FILE_CONTENT")
        stored = await upload_file(
            content,
            document.filename or "documento.pdf",
            "application/pdf",
            settings.s3_document_key_prefix,
        )
        uploaded_key = stored.key
        archive = Archivo(
            nombre_original=document.filename or "documento.pdf",
            nombre_unico=stored.key,
            mimetype="application/pdf",
            url=stored.url,
            tamanio=len(content),
        )
        try:
            db.add(archive)
            await db.flush()
        except Exception:
            await db.rollback()
            with suppress(Exception):
                await delete_file(uploaded_key)
            raise
        archive_id = archive.id_arch

    try:
        final_status = "Aceptado" if payload.tipo == "Normal" else "Pendiente"
        permission = Permiso(
            id_u=user_id,
            tipo=payload.tipo,
            duracion_t=sum(item.duracion for item in payload.detalles),
            estado=final_status,
            id_arch=archive_id,
            autor="Usuario",
        )
        db.add(permission)
        await db.flush()
        await _create_details(db, permission.id_p, payload.detalles)
        db.add(
            Notificacion(
                mensaje=f"Se creó un nuevo permiso de tipo {payload.tipo}",
                tipo=final_status,
                id_p=permission.id_p,
                leido=False,
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()
        if uploaded_key:
            with suppress(Exception):
                await delete_file(uploaded_key)
        raise
    user = await db.get(User, user_id)
    external = await get_usuario(user.codigo) if user else None
    if external and user and external.get("email"):
        await send_email(
            str(external["email"]),
            "Permiso registrado",
            f"Su permiso tipo {payload.tipo} fue {final_status}",
            (
                f"<p>Hola <b>{external.get('nombre_completo', user.codigo)}</b>,</p>"
                f"<p>Tu permiso de tipo <b>{payload.tipo}</b> fue registrado con estado "
                f"<b>{final_status}</b>.</p>"
            ),
        )
    return {
        "id_p": permission.id_p,
        "tipo": payload.tipo,
        "estado": final_status,
        "total_detalles": len(payload.detalles),
    }


async def list_permissions(db: AsyncSession, estado: str | None) -> list[dict[str, Any]]:
    stmt = (
        select(
            Permiso.id_p,
            Permiso.fecha_creacion,
            Permiso.id_arch.is_not(None).label("tiene_documento"),
            Permiso.tipo,
            Permiso.duracion_t,
            Permiso.estado,
            Permiso.autor,
        )
        .order_by(Permiso.fecha_creacion.desc())
    )
    if estado:
        stmt = stmt.where(Permiso.estado == estado)
    return [dict(row) for row in (await db.execute(stmt)).mappings().all()]


async def get_details(
    db: AsyncSession, permission_id: int, user_id: int | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(
            Permiso.id_p,
            Permiso.tipo,
            Permiso.estado,
            Permiso.fecha_creacion,
            DetallePermiso.id_l,
            DetallePermiso.fecha,
            DetallePermiso.hora_inicio,
            DetallePermiso.hora_fin,
            DetallePermiso.duracion,
            Losa.ubicacion,
            Disciplina.nombre.label("disciplina"),
        )
        .join(DetallePermiso, Permiso.id_p == DetallePermiso.id_p)
        .join(Losa, DetallePermiso.id_l == Losa.id_l)
        .outerjoin(Disciplina, Losa.id_d == Disciplina.id_d)
        .where(Permiso.id_p == permission_id)
        .order_by(DetallePermiso.fecha, DetallePermiso.hora_inicio)
    )
    if user_id is not None:
        stmt = stmt.where(Permiso.id_u == user_id)
    rows = [dict(row) for row in (await db.execute(stmt)).mappings().all()]
    if not rows:
        raise AppError("Permiso no encontrado", 404)
    return rows


async def blocked_details(db: AsyncSession) -> list[dict[str, Any]]:
    stmt = (
        select(
            DetallePermiso.id_l,
            DetallePermiso.fecha,
            DetallePermiso.hora_inicio,
            DetallePermiso.hora_fin,
        )
        .join(Permiso, Permiso.id_p == DetallePermiso.id_p)
        .where(
            Permiso.estado.in_(("Pendiente", "Aceptado")),
            DetallePermiso.fecha >= date.today(),
        )
        .order_by(DetallePermiso.fecha, DetallePermiso.hora_inicio)
    )
    return [dict(row) for row in (await db.execute(stmt)).mappings().all()]


async def accepted_details(db: AsyncSession) -> list[dict[str, Any]]:
    stmt = (
        select(
            DetallePermiso.id_l,
            DetallePermiso.fecha,
            DetallePermiso.hora_inicio,
            DetallePermiso.hora_fin,
            Permiso.estado,
            Losa.numero_l,
            Disciplina.nombre,
            Permiso.id_arch.is_not(None).label("tiene_documento"),
            Permiso.id_p,
            Permiso.tipo,
        )
        .join(Permiso, Permiso.id_p == DetallePermiso.id_p)
        .join(Losa, DetallePermiso.id_l == Losa.id_l)
        .outerjoin(Disciplina, Disciplina.id_d == Losa.id_d)
        .where(
            Permiso.estado == "Aceptado",
            DetallePermiso.fecha == date.today(),
            DetallePermiso.hora_fin > datetime.now().time(),
        )
        .order_by(Permiso.id_p.desc(), DetallePermiso.fecha, DetallePermiso.hora_inicio)
    )
    return [dict(row) for row in (await db.execute(stmt)).mappings().all()]


async def accepted_future(db: AsyncSession) -> list[dict[str, Any]]:
    stmt = (
        select(
            Permiso.id_p,
            Permiso.tipo,
            Permiso.estado,
            Permiso.id_arch.is_not(None).label("tiene_documento"),
        )
        .join(DetallePermiso, DetallePermiso.id_p == Permiso.id_p)
        .where(
            Permiso.estado == "Aceptado",
            or_(
                DetallePermiso.fecha > date.today(),
                and_(
                    DetallePermiso.fecha == date.today(),
                    DetallePermiso.hora_fin > datetime.now().time(),
                ),
            ),
        )
        .distinct()
        .order_by(Permiso.id_p.desc())
    )
    return [dict(row) for row in (await db.execute(stmt)).mappings().all()]


async def update_status(db: AsyncSession, permission_id: int, estado: str, worker_id: int) -> dict[str, Any]:
    decision_worker = await db.get(Trabajador, worker_id)
    if decision_worker is None or decision_worker.estado != "Activo":
        raise AppError("Administrador aprobador no encontrado o inactivo", 403)
    permission = await db.scalar(
        select(Permiso).where(Permiso.id_p == permission_id).with_for_update()
    )
    if permission is None:
        raise AppError("Permiso no encontrado", 404)

    allowed_transitions = {
        "Pendiente": {"Aceptado", "Rechazado", "Cancelado"},
        "Aceptado": {"Cancelado"},
        "Rechazado": {"Pendiente"},
        "Cancelado": {"Pendiente"},
    }
    current_status = str(permission.estado)
    if estado == current_status:
        raise AppError(f"El permiso ya se encuentra {estado.lower()}", 400)
    if estado not in allowed_transitions.get(current_status, set()):
        raise AppError(f"No se puede cambiar un permiso {current_status} a {estado}", 400)

    if estado in {"Pendiente", "Aceptado"}:
        stored_details = list(
            (await db.scalars(select(DetallePermiso).where(DetallePermiso.id_p == permission_id))).all()
        )
        details = [
            DetallePermisoIn(
                id_l=item.id_l,
                fecha=item.fecha,
                hora_inicio=item.hora_inicio,
                hora_fin=item.hora_fin,
                duracion=item.duracion,
            )
            for item in stored_details
        ]
        await _validate_details(db, details, enforce_request_window=False)
        conflicts = await _conflicts(db, details, exclude_permission_id=permission_id)
        if conflicts:
            raise AppError(
                "No se puede aceptar el permiso porque uno o más horarios ya están ocupados "
                "o no están disponibles",
                409,
                "SCHEDULE_CONFLICT",
                conflicts=conflicts,
            )
        if estado == "Aceptado" and permission.tipo == "Especial":
            document_reasons, _ = await _document_policy_reasons(db, permission, details)
            if document_reasons:
                raise AppError(
                    "El permiso especial no cumple la política documental",
                    422,
                    "DOCUMENT_POLICY_REJECTED",
                    details={"motivos": document_reasons},
                )

    permission.estado = estado
    if estado == "Pendiente":
        permission.id_t_decision = None
        permission.fecha_decision = None
    else:
        permission.id_t_decision = worker_id
        permission.fecha_decision = _utc_naive()
    db.add(
        Notificacion(
            mensaje=f"El estado de tu permiso ha cambiado a: {estado}",
            tipo=estado,
            id_p=permission_id,
            leido=False,
        )
    )
    await db.commit()
    recipient = ""
    recipient_name = "Usuario"
    if permission.autor == "Administrador":
        worker = await db.get(Trabajador, permission.id_t) if permission.id_t else None
        if worker:
            recipient, recipient_name = worker.email, f"{worker.nombres} {worker.apellido_p}"
    elif permission.id_u:
        owner = await db.get(User, permission.id_u)
        external = await get_usuario(owner.codigo) if owner else None
        if external:
            recipient = str(external.get("email") or "")
            recipient_name = str(external.get("nombre_completo") or recipient_name)
    if recipient:
        await send_email(
            recipient,
            "Estado de permiso actualizado",
            f"Tu permiso {permission.tipo} fue actualizado a: {estado}.",
            f"<p>Estimado/a <b>{recipient_name}</b>, tu permiso fue actualizado a <b>{estado}</b>.</p>",
        )
    return {"success": True, "message": "Permiso actualizado correctamente"}


async def get_document(db: AsyncSession, permission_id: int, user_id: int | None) -> str:
    stmt = (
        select(Archivo.nombre_unico)
        .join(Permiso, Permiso.id_arch == Archivo.id_arch)
        .where(Permiso.id_p == permission_id)
    )
    if user_id is not None:
        stmt = stmt.where(Permiso.id_u == user_id)
    key = await db.scalar(stmt)
    if not key:
        raise AppError("Permiso o documento no encontrado", 404)
    return await signed_download_url(key)


async def by_user(db: AsyncSession, user_id: int) -> list[dict[str, Any]]:
    stmt = (
        select(
            Permiso.id_p,
            Permiso.tipo,
            Permiso.duracion_t,
            Permiso.estado,
            Permiso.fecha_creacion,
        )
        .where(Permiso.id_u == user_id)
        .order_by(Permiso.fecha_creacion.desc())
    )
    return [dict(row) for row in (await db.execute(stmt)).mappings().all()]


async def create_worker_permission(
    db: AsyncSession,
    payload: PermisoTrabajadorIn,
    approver_id: int,
    document: UploadFile | None,
) -> dict[str, Any]:
    worker_owner = await db.get(Trabajador, payload.id_t)
    if worker_owner is None or worker_owner.estado != "Activo":
        raise AppError("Trabajador no encontrado o inactivo", 404)
    await _validate_details(db, payload.detalles, enforce_request_window=True)
    conflicts = await _conflicts(db, payload.detalles)
    if conflicts:
        raise AppError(
            "No se puede registrar el permiso porque uno o más horarios ya están ocupados "
            "o no están disponibles",
            409,
            "SCHEDULE_CONFLICT",
            conflicts=conflicts,
        )
    archive_id: int | None = None
    uploaded_key: str | None = None
    if payload.tipo == "Especial":
        if document is None:
            raise AppError("El documento es obligatorio para permisos especiales", 400)
        content = await document.read(10 * 1024 * 1024 + 1)
        if (
            document.content_type != "application/pdf"
            or not (document.filename or "").lower().endswith(".pdf")
            or not content.startswith(b"%PDF-")
        ):
            raise AppError("Solo se permiten documentos PDF válidos", 400, "INVALID_FILE_TYPE")
        if len(content) > 10 * 1024 * 1024:
            raise AppError("El archivo no debe superar 10 MB", 413, "FILE_TOO_LARGE")
        stored = await upload_file(
            content,
            document.filename or "documento.pdf",
            "application/pdf",
            settings.s3_document_key_prefix,
        )
        uploaded_key = stored.key
        archive = Archivo(
            nombre_original=document.filename or "documento.pdf",
            nombre_unico=stored.key,
            mimetype="application/pdf",
            url=stored.url,
            tamanio=len(content),
        )
        try:
            db.add(archive)
            await db.flush()
        except Exception:
            await db.rollback()
            with suppress(Exception):
                await delete_file(uploaded_key)
            raise
        archive_id = archive.id_arch
    try:
        permission = Permiso(
            id_t=payload.id_t,
            id_t_decision=approver_id,
            tipo=payload.tipo,
            id_arch=archive_id,
            duracion_t=sum(item.duracion for item in payload.detalles),
            estado="Aceptado",
            fecha_decision=_utc_naive(),
            autor="Administrador",
        )
        db.add(permission)
        await db.flush()
        await _create_details(db, permission.id_p, payload.detalles)
        db.add(
            Notificacion(
                mensaje=f"Permiso tipo {payload.tipo} registrado por trabajador",
                tipo="Aceptado",
                id_p=permission.id_p,
                leido=False,
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()
        if uploaded_key:
            with suppress(Exception):
                await delete_file(uploaded_key)
        raise
    worker = await db.get(Trabajador, payload.id_t)
    if worker and worker.email:
        await send_email(
            worker.email,
            "Permiso registrado",
            f"Se ha registrado un permiso de tipo {payload.tipo}",
            f"<p>Estimado/a <b>{worker.nombres} {worker.apellido_p}</b>, el permiso fue registrado.</p>",
        )
    return {
        "id_p": permission.id_p,
        "tipo": payload.tipo,
        "estado": "Aceptado",
        "duracion_t": payload.duracion_t,
        "detalles": [item.model_dump(mode="json") for item in payload.detalles],
    }
