from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.serialization import model_dict
from app.models import DiaBloqueado
from app.modules.dias_bloqueados.schemas import DiaBloqueadoIn


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (await db.scalars(select(DiaBloqueado).order_by(DiaBloqueado.fecha.desc()))).all()
    return [model_dict(row) for row in rows]


async def create(db: AsyncSession, payload: DiaBloqueadoIn) -> int:
    item = DiaBloqueado(fecha=payload.fecha, motivo=payload.motivo)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("La fecha ya está registrada", 409) from exc
    await db.refresh(item)
    return item.id


async def delete_one(db: AsyncSession, item_id: int) -> None:
    item = await db.get(DiaBloqueado, item_id)
    if item is None:
        raise AppError("Día bloqueado no encontrado", 404)
    await db.delete(item)
    await db.commit()
