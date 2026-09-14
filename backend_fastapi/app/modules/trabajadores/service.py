from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.security import hash_password, verify_password
from app.core.serialization import model_dict
from app.models import Trabajador
from app.modules.trabajadores.schemas import TrabajadorCreate, TrabajadorUpdate


def _split_apellidos(apellidos: str) -> tuple[str, str]:
    parts = apellidos.strip().split()
    return parts[0] if parts else "", " ".join(parts[1:])


async def create(db: AsyncSession, payload: TrabajadorCreate) -> int:
    if await db.scalar(select(Trabajador.id_t).where(Trabajador.email == str(payload.email))):
        raise AppError("El correo ya está registrado", 400)
    apellido_p, apellido_m = _split_apellidos(payload.apellidos)
    worker = Trabajador(
        dni=payload.dni,
        nombres=payload.nombres,
        apellido_p=apellido_p,
        apellido_m=apellido_m,
        rol=payload.rol,
        email=str(payload.email),
        password=await hash_password(payload.password),
        telefono=payload.telefono,
        estado="Activo",
    )
    db.add(worker)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("DNI o correo ya registrado", 409) from exc
    await db.refresh(worker)
    return worker.id_t


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (await db.scalars(select(Trabajador).order_by(Trabajador.id_t))).all()
    return [model_dict(row, exclude={"password"}) for row in rows]


async def get_one(db: AsyncSession, worker_id: int) -> dict[str, Any]:
    worker = await db.get(Trabajador, worker_id)
    if worker is None:
        raise AppError("Trabajador no encontrado", 404)
    return model_dict(worker, exclude={"password"})


async def update_one(db: AsyncSession, worker_id: int, payload: TrabajadorUpdate) -> None:
    worker = await db.get(Trabajador, worker_id)
    if worker is None:
        raise AppError("Trabajador no encontrado", 404)
    worker.apellido_p, worker.apellido_m = _split_apellidos(payload.apellidos)
    worker.nombres = payload.nombres
    worker.rol = payload.rol
    worker.telefono = payload.telefono
    await db.commit()


async def delete_one(db: AsyncSession, worker_id: int) -> None:
    worker = await db.get(Trabajador, worker_id)
    if worker is None:
        raise AppError("Trabajador no encontrado", 404)
    await db.delete(worker)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("No se puede eliminar porque tiene registros relacionados", 409) from exc


async def change_password(db: AsyncSession, worker_id: int, current: str, new: str) -> None:
    worker = await db.get(Trabajador, worker_id)
    if worker is None:
        raise AppError("Trabajador no encontrado", 404)
    if not await verify_password(current, worker.password):
        raise AppError("La contraseña actual es incorrecta", 400)
    worker.password = await hash_password(new)
    await db.commit()
