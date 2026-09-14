from typing import Any

from fastapi import APIRouter, status

from app.core.database import DBSession
from app.modules.trabajadores import service
from app.modules.trabajadores.schemas import PasswordChange, TrabajadorCreate, TrabajadorUpdate

router = APIRouter(prefix="/trabajadores", tags=["Trabajadores"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(payload: TrabajadorCreate, db: DBSession) -> dict[str, Any]:
    return {"message": "Trabajador registrado", "id": await service.create(db, payload)}


@router.get("/")
async def list_all(db: DBSession) -> list[dict[str, Any]]:
    return await service.list_all(db)


@router.put("/{worker_id}")
async def update_one(worker_id: int, payload: TrabajadorUpdate, db: DBSession) -> dict[str, str]:
    await service.update_one(db, worker_id, payload)
    return {"message": "Trabajador actualizado correctamente"}


@router.delete("/{worker_id}")
async def delete_one(worker_id: int, db: DBSession) -> dict[str, str]:
    await service.delete_one(db, worker_id)
    return {"message": "Trabajador eliminado correctamente"}


@router.put("/password/{worker_id}")
async def change_password(worker_id: int, payload: PasswordChange, db: DBSession) -> dict[str, str]:
    await service.change_password(db, worker_id, payload.actualPassword, payload.nuevaPassword)
    return {"message": "Contraseña actualizada correctamente"}


@router.get("/{worker_id}")
async def get_one(worker_id: int, db: DBSession) -> dict[str, Any]:
    return {"success": True, "data": await service.get_one(db, worker_id)}
