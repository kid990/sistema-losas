from typing import Any

from fastapi import APIRouter, status

from app.core.database import DBSession
from app.modules.dias_bloqueados import service
from app.modules.dias_bloqueados.schemas import DiaBloqueadoIn

router = APIRouter(prefix="/dias-bloqueados", tags=["Días bloqueados"])


@router.get("/")
async def list_all(db: DBSession) -> list[dict[str, Any]]:
    return await service.list_all(db)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(payload: DiaBloqueadoIn, db: DBSession) -> dict[str, Any]:
    return {"message": "Día bloqueado registrado correctamente", "id": await service.create(db, payload)}


@router.delete("/{item_id}")
async def delete_one(item_id: int, db: DBSession) -> dict[str, str]:
    await service.delete_one(db, item_id)
    return {"message": "Día bloqueado eliminado correctamente"}
