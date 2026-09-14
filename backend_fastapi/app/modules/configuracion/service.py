from datetime import time
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.serialization import model_dict
from app.models import ConfiguracionGlobal
from app.modules.configuracion.schemas import ConfiguracionUpdate


async def get(db: AsyncSession) -> dict[str, Any]:
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
        await db.commit()
        await db.refresh(config)
    return model_dict(config)


async def update(db: AsyncSession, payload: ConfiguracionUpdate) -> None:
    config = await db.get(ConfiguracionGlobal, 1)
    if config is None:
        await get(db)
        config = await db.get(ConfiguracionGlobal, 1)
    assert config is not None
    for key, value in payload.model_dump().items():
        setattr(config, key, value)
    await db.commit()
