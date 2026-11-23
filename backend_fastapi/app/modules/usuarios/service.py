import asyncio
import os
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.security import hash_password, verify_password
from app.integrations.unheval import get_usuario, list_usuarios
from app.models import User

_ROLES = ("Alumno", "Docente", "PersonalAdministrativo")
_HASH_CONCURRENCY = max(4, min(16, os.cpu_count() or 4))
_INSERT_BATCH_SIZE = 1000
_MAX_ERROR_DETAILS = 100


def _normalize_role(value: Any) -> str:
    key = str(value or "").strip().lower()
    if key == "docente":
        return "Docente"
    if key in {"personaladministrativo", "personal administrativo", "administrativo"}:
        return "PersonalAdministrativo"
    return "Alumno"


def _empty_role_report() -> dict[str, Any]:
    return {"procesados": 0, "creados": 0, "existentes": 0, "errores": 0, "detalles": []}


async def _hash_passwords(passwords: list[str]) -> list[str]:
    """Calcula bcrypt en paralelo; cada hash corre fuera del event loop."""
    semaphore = asyncio.Semaphore(_HASH_CONCURRENCY)

    async def hash_one(password: str) -> str:
        async with semaphore:
            return await hash_password(password)

    return list(await asyncio.gather(*(hash_one(password) for password in passwords)))


async def load_users(db: AsyncSession) -> dict[str, Any]:
    records = await list_usuarios()
    report: dict[str, Any] = {
        "totalProcesados": 0,
        "totalCreados": 0,
        "totalExistentes": 0,
        "totalErrores": 0,
        "roles": {},
        "erroresDetalles": [],
    }
    roles = {role: _empty_role_report() for role in _ROLES}
    candidates: dict[str, dict[str, str]] = {}

    for record in records:
        report["totalProcesados"] += 1
        role = _normalize_role(record.get("rol"))
        role_report = roles[role]
        role_report["procesados"] += 1
        codigo = str(record.get("codigo") or "").strip()
        dni = record.get("dni")
        if not codigo or not dni:
            report["totalErrores"] += 1
            role_report["errores"] += 1
            if len(role_report["detalles"]) < _MAX_ERROR_DETAILS:
                role_report["detalles"].append({"codigo": codigo or None, "error": "Campos faltantes"})
            continue
        if codigo in candidates:
            report["totalExistentes"] += 1
            role_report["existentes"] += 1
            continue
        candidates[codigo] = {"codigo": codigo, "rol": role}

    existing = set((await db.scalars(select(User.codigo))).all())
    pending = [item for code, item in candidates.items() if code not in existing]
    report["totalExistentes"] += len(candidates) - len(pending)
    for item in candidates.values():
        if item["codigo"] in existing:
            roles[item["rol"]]["existentes"] += 1

    if pending:
        hashes = await _hash_passwords([item["codigo"] for item in pending])
        rows = [
            {
                "codigo": item["codigo"],
                "password": hashed,
                "rol": item["rol"],
                "estado": "Activo",
            }
            for item, hashed in zip(pending, hashes, strict=True)
        ]
        for start in range(0, len(rows), _INSERT_BATCH_SIZE):
            batch = rows[start : start + _INSERT_BATCH_SIZE]
            result = await db.execute(
                insert(User)
                .values(batch)
                .on_conflict_do_nothing(index_elements=["codigo"])
                .returning(User.codigo)
            )
            created = set(result.scalars().all())
            report["totalCreados"] += len(created)
            for item in batch:
                if item["codigo"] in created:
                    roles[item["rol"]]["creados"] += 1
        await db.commit()

    for role in _ROLES:
        report["roles"][role] = roles[role]
    report["erroresDetalles"] = [
        detail for role in _ROLES for detail in roles[role]["detalles"]
    ]
    return report


async def counts(db: AsyncSession) -> dict[str, int]:
    rows = (
        await db.execute(select(User.rol, func.count(User.id_u)).group_by(User.rol))
    ).all()
    by_role = {str(rol): int(total) for rol, total in rows}
    return {
        "total": sum(by_role.values()),
        "alumnos": by_role.get("Alumno", 0),
        "docentes": by_role.get("Docente", 0),
        "personal_administrativo": by_role.get("PersonalAdministrativo", 0),
    }


async def set_status(db: AsyncSession, codigo: str, estado: str) -> dict[str, str]:
    user = await db.scalar(select(User).where(User.codigo == codigo))
    if user is None:
        raise AppError("Usuario no encontrado", 404)
    user.estado = estado
    await db.commit()
    return {"codigo": codigo, "nuevoEstado": estado}


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    users = (
        await db.execute(
            select(User.id_u, User.codigo, User.rol, User.estado).order_by(User.id_u)
        )
    ).all()
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
