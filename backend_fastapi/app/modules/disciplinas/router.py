from typing import Any

from fastapi import APIRouter, status

from app.core.database import DBSession
from app.modules.disciplinas import service
from app.modules.disciplinas.schemas import DisciplinaIn, EstadoIn

router = APIRouter(prefix="/disciplinas", tags=["Disciplinas"])


@router.get("/")
async def list_all(db: DBSession) -> list[dict[str, Any]]:
    return await service.list_all(db)


@router.get("/activas")
async def list_active(db: DBSession) -> list[dict[str, Any]]:
    return await service.list_all(db, active_only=True)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(payload: DisciplinaIn, db: DBSession) -> dict[str, Any]:
    return {"message": "Disciplina creada correctamente", "id": await service.create(db, payload.nombre)}


@router.get("/{item_id}")
async def get_one(item_id: int, db: DBSession) -> dict[str, Any]:
    return await service.get_one(db, item_id)


@router.put("/{item_id}")
async def rename(item_id: int, payload: DisciplinaIn, db: DBSession) -> dict[str, str]:
    await service.rename(db, item_id, payload.nombre)
    return {"message": "Disciplina actualizada correctamente"}


@router.delete("/{item_id}")
async def delete_one(item_id: int, db: DBSession) -> dict[str, str]:
    await service.delete_one(db, item_id)
    return {"message": "Disciplina eliminada correctamente"}


@router.patch("/{item_id}/estado")
async def set_status(item_id: int, payload: EstadoIn, db: DBSession) -> dict[str, str]:
    await service.set_status(db, item_id, payload.estado)
    return {"message": f"Disciplina marcada como {payload.estado}"}
