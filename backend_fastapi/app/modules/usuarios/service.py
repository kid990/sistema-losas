import asyncio
from collections import defaultdict
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.security import hash_password, verify_password
from app.integrations.unheval import get_usuario, list_usuarios
from app.models import User


async def load_users(db: AsyncSession) -> dict[str, Any]:
    records = await list_usuarios()
    by_role: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_role[str(record.get("rol") or "Alumno")].append(record)
    report: dict[str, Any] = {
        "totalProcesados": 0,
        "totalCreados": 0,
        "totalExistentes": 0,
        "totalErrores": 0,
        "roles": {},
        "erroresDetalles": [],
    }
    for role, grouped in by_role.items():
        if role not in {"Alumno", "Docente", "PersonalAdministrativo"}:
            role = "Alumno"
        role_report: dict[str, Any] = {
            "procesados": len(grouped),
            "creados": 0,
            "existentes": 0,
            "errores": 0,
            "detalles": [],
        }
        for record in grouped:
            codigo, dni = record.get("codigo"), record.get("dni")
            report["totalProcesados"] += 1
            if not codigo or not dni:
                report["totalErrores"] += 1
                role_report["errores"] += 1
                role_report["detalles"].append({"codigo": codigo, "error": "Campos faltantes"})
                continue
            if await db.scalar(select(User.id_u).where(User.codigo == str(codigo))):
                report["totalExistentes"] += 1
                role_report["existentes"] += 1
                continue
            db.add(
                User(codigo=str(codigo), password=await hash_password(str(codigo)), rol=role, estado="Activo")
            )
            report["totalCreados"] += 1
            role_report["creados"] += 1
        await db.commit()
        report["roles"][role] = role_report
        await asyncio.sleep(0)
    return report


async def set_status(db: AsyncSession, codigo: str, estado: str) -> dict[str, str]:
    user = await db.scalar(select(User).where(User.codigo == codigo))
    if user is None:
        raise AppError("Usuario no encontrado", 404)
    user.estado = estado
    await db.commit()
    return {"codigo": codigo, "nuevoEstado": estado}


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    users = (await db.scalars(select(User).order_by(User.id_u))).all()
    if not users:
        return []

    try:
        # La API académica es opcional para este listado. No debe bloquear la
        # navegación administrativa cuando el proxy UNHEVAL está apagado.
        external = await asyncio.wait_for(list_usuarios(), timeout=1.0)
        by_code = {str(item.get("codigo")): item for item in external}
    except (TimeoutError, httpx.HTTPError, ValueError):
        by_code = {}
    return [
        {
            "id_u": user.id_u,
            "codigo": user.codigo,
            "rol": user.rol,
            "estado": user.estado,
            "nombre_completo": by_code.get(user.codigo, {}).get("nombre_completo", "-"),
            "escuela": by_code.get(user.codigo, {}).get("escuela", "-"),
        }
        for user in users
    ]


async def get_one(db: AsyncSession, user_id: int) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("Usuario no encontrado", 404)
    result = {"id_u": user.id_u, "codigo": user.codigo, "rol": user.rol, "estado": user.estado}
    external = await get_usuario(user.codigo)
    if external:
        result.update(
            nombre_completo=external.get("nombre_completo", "-"),
            nombres=external.get("nombres") or external.get("nombre_completo") or "-",
            apellido_p=external.get("apellido_p", ""),
            apellido_m=external.get("apellido_m", ""),
            email=external.get("email", "-"),
            escuela=external.get("escuela", "-"),
            dni=external.get("dni", "-"),
        )
    else:
        result.update(nombre_completo="-", email="-", escuela="-", dni="-")
    return result


async def change_password(db: AsyncSession, user_id: int, current: str, new: str) -> None:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("Usuario no encontrado", 404)
    if not await verify_password(current, user.password):
        raise AppError("La contraseña actual es incorrecta", 400)
    user.password = await hash_password(new)
    await db.commit()
