from typing import Annotated, Any

from fastapi import APIRouter, Depends, status

from app.core.database import DBSession
from app.core.security import CurrentUser, require_roles
from app.modules.jobs import service as jobs_service
from app.modules.jobs.schemas import JobQueued
from app.modules.usuarios import service
from app.modules.usuarios.schemas import EstadoUsuarioIn, PasswordChange
from app.queue.dispatch import enqueue
from app.queue.tasks.users import synchronize_users_task

router = APIRouter(prefix="/users", tags=["Usuarios"])
Admin = Annotated[CurrentUser, Depends(require_roles("Administrador"))]


@router.post("/cargar")
async def load_users(db: DBSession) -> dict[str, Any]:
    data = await service.load_users(db)
    return {"success": True, "message": "Carga masiva completada", "data": data}


@router.post("/cargar-async", response_model=JobQueued, status_code=status.HTTP_202_ACCEPTED)
def load_users_async(_admin: Admin) -> JobQueued:
    task_id = enqueue(synchronize_users_task, queue="sync")
    return jobs_service.queued(task_id)


@router.put("/estado")
async def set_status(payload: EstadoUsuarioIn, db: DBSession) -> dict[str, Any]:
    return {"success": True, "data": await service.set_status(db, payload.codigo, payload.estado)}


@router.get("/")
async def list_all(db: DBSession) -> dict[str, Any]:
    return {"success": True, "data": await service.list_all(db)}


@router.get("/{user_id}")
async def get_one(user_id: int, db: DBSession) -> dict[str, Any]:
    return {"success": True, "data": await service.get_one(db, user_id)}


@router.put("/password/{user_id}")
async def change_password(user_id: int, payload: PasswordChange, db: DBSession) -> dict[str, str]:
    await service.change_password(db, user_id, payload.actualPassword, payload.nuevaPassword)
    return {"message": "Contraseña actualizada correctamente"}
