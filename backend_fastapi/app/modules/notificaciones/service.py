from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.serialization import model_dict
from app.models import Notificacion, Permiso
from app.modules.notificaciones.schemas import NotificacionIn


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (await db.scalars(select(Notificacion).order_by(Notificacion.fecha_envio.desc()))).all()
    return [model_dict(row) for row in rows]


async def by_permission(db: AsyncSession, permission_id: int) -> list[dict[str, Any]]:
    rows = (
        await db.scalars(
            select(Notificacion)
            .where(Notificacion.id_p == permission_id)
            .order_by(Notificacion.fecha_envio.desc())
        )
    ).all()
    return [model_dict(row) for row in rows]


async def by_user(db: AsyncSession, user_id: int) -> list[dict[str, Any]]:
    rows = (
        await db.scalars(
            select(Notificacion)
            .join(Permiso, Notificacion.id_p == Permiso.id_p)
            .where(Permiso.id_u == user_id)
            .order_by(Notificacion.fecha_envio.desc())
        )
    ).all()
    return [model_dict(row) for row in rows]


async def create(db: AsyncSession, payload: NotificacionIn) -> int:
    item = Notificacion(**payload.model_dump(), leido=False)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item.id_n


async def mark_read(db: AsyncSession, notification_id: int, user_id: int | None) -> None:
    stmt = update(Notificacion).where(Notificacion.id_n == notification_id)
    if user_id is not None:
        allowed = select(Permiso.id_p).where(Permiso.id_u == user_id)
        stmt = stmt.where(Notificacion.id_p.in_(allowed))
    result = await db.execute(stmt.values(leido=True))
    if getattr(result, "rowcount", 0) == 0:
        raise AppError("Notificación no encontrada", 404)
    await db.commit()


async def mark_all_read(db: AsyncSession, user_id: int) -> int:
    owned = select(Permiso.id_p).where(Permiso.id_u == user_id)
    result = await db.execute(
        update(Notificacion)
        .where(Notificacion.id_p.in_(owned), Notificacion.leido.is_(False))
        .values(leido=True)
    )
    await db.commit()
    return int(getattr(result, "rowcount", 0) or 0)


async def count_unread(db: AsyncSession, user_id: int) -> int:
    total = await db.scalar(
        select(func.count(Notificacion.id_n))
        .join(Permiso, Notificacion.id_p == Permiso.id_p)
        .where(Permiso.id_u == user_id, Notificacion.leido.is_(False))
    )
    return int(total or 0)
