from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.serialization import model_dict
from app.models import PrediccionOcupacion


async def list_range(db: AsyncSession, desde: date, hasta: date) -> list[dict[str, Any]]:
    stmt = (
        select(PrediccionOcupacion)
        .where(PrediccionOcupacion.fecha.between(desde, hasta))
        .order_by(PrediccionOcupacion.fecha, PrediccionOcupacion.hora, PrediccionOcupacion.id_l)
    )
    rows = (await db.scalars(stmt)).all()
    return [
        {**model_dict(row), "probabilidad": float(row.probabilidad)} for row in rows
    ]
