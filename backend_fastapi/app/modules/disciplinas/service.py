from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.serialization import model_dict
from app.models import Disciplina


async def list_all(db: AsyncSession, active_only: bool = False) -> list[dict[str, Any]]:
    stmt = select(Disciplina).order_by(Disciplina.id_d)
    if active_only:
        stmt = stmt.where(Disciplina.estado == "Activo")
    return [model_dict(item) for item in (await db.scalars(stmt)).all()]


async def create(db: AsyncSession, nombre: str) -> int:
    if await db.scalar(select(Disciplina.id_d).where(Disciplina.nombre == nombre)):
        raise AppError("El nombre ya está registrado", 400)
    item = Disciplina(nombre=nombre, estado="Activo")
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item.id_d


async def get_one(db: AsyncSession, item_id: int) -> dict[str, Any]:
    item = await db.get(Disciplina, item_id)
    if item is None:
        raise AppError("No encontrada", 404)
    return model_dict(item)


async def rename(db: AsyncSession, item_id: int, nombre: str) -> None:
    item = await db.get(Disciplina, item_id)
    if item is None:
        raise AppError("Disciplina no encontrada", 404)
    item.nombre = nombre
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("El nombre ya está registrado", 409) from exc


async def delete_one(db: AsyncSession, item_id: int) -> None:
    item = await db.get(Disciplina, item_id)
    if item is None:
        raise AppError("Disciplina no encontrada", 404)
    await db.delete(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("No se puede eliminar porque tiene losas relacionadas", 409) from exc


async def set_status(db: AsyncSession, item_id: int, estado: str) -> None:
    item = await db.get(Disciplina, item_id)
    if item is None:
        raise AppError("Disciplina no encontrada", 404)
    item.estado = estado
    await db.commit()
