from typing import Annotated, Any

from fastapi import APIRouter, Depends, status

from app.core.database import DBSession
from app.core.exceptions import AppError
from app.core.security import AuthenticatedUser, CurrentUser, require_roles
from app.modules.notificaciones import service
from app.modules.notificaciones.schemas import NotificacionIn

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])
Admin = Annotated[CurrentUser, Depends(require_roles("Administrador"))]


def _assert_owner(user: CurrentUser, user_id: int, action: str) -> None:
    if user.tipo == "usuario" and user.id != user_id:
        raise AppError(f"No autorizado para {action} estas notificaciones", 403)


@router.get("/")
async def list_all(db: DBSession, _admin: Admin) -> dict[str, Any]:
    return {"success": True, "data": await service.list_all(db)}


@router.get("/permiso/{permission_id}")
async def by_permission(permission_id: int, db: DBSession, _admin: Admin) -> dict[str, Any]:
    return {"success": True, "data": await service.by_permission(db, permission_id)}


@router.get("/usuario/{user_id}")
async def by_user(user_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    _assert_owner(user, user_id, "consultar")
    return {"success": True, "data": await service.by_user(db, user_id)}


@router.get("/usuario/{user_id}/no-leidas")
async def count_unread(user_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    _assert_owner(user, user_id, "consultar")
    return {"success": True, "data": {"total": await service.count_unread(db, user_id)}}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(payload: NotificacionIn, db: DBSession, _admin: Admin) -> dict[str, Any]:
    item_id = await service.create(db, payload)
    return {"success": True, "data": {"id_n": item_id}, "message": "Notificación creada"}


@router.patch("/{notification_id}/leido")
async def mark_read(notification_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    await service.mark_read(db, notification_id, user.id if user.tipo == "usuario" else None)
    return {"success": True, "message": "Notificación marcada como leída"}


@router.patch("/usuario/{user_id}/leidas")
async def mark_all_read(user_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    _assert_owner(user, user_id, "actualizar")
    count = await service.mark_all_read(db, user_id)
    return {"success": True, "message": f"{count} notificación(es) marcadas como leídas"}
