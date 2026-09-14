import json
from typing import Annotated, Any, NoReturn

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.core.database import DBSession
from app.core.exceptions import AppError
from app.core.security import AuthenticatedUser, CurrentUser, require_roles
from app.modules.permisos import service
from app.modules.permisos.schemas import EstadoPermisoIn, PermisoIn, PermisoTrabajadorIn

router = APIRouter(prefix="/permisos", tags=["Permisos"])
Admin = Annotated[CurrentUser, Depends(require_roles("Administrador"))]
Staff = Annotated[CurrentUser, Depends(require_roles("Administrador", "Seguridad"))]


def _raise_validation_error(exc: ValidationError) -> NoReturn:
    errors = [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": str(error["msg"]).removeprefix("Value error, "),
            "type": error["type"],
        }
        for error in exc.errors(include_context=False, include_url=False)
    ]
    message = errors[0]["message"] if errors else "Datos inválidos para registrar el permiso"
    raise AppError(message, 422, "VALIDATION_ERROR", {"errors": errors}) from exc


async def _permission_payload(request: Request) -> tuple[PermisoIn, UploadFile | None]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        raw_details = form.get("detalles")
        if not isinstance(raw_details, str):
            raise AppError("Faltan detalles", 400)
        try:
            details = json.loads(raw_details)
        except json.JSONDecodeError as exc:
            raise AppError("El campo detalles no contiene JSON válido", 400) from exc
        document = form.get("documento")
        data = {
            "tipo": form.get("tipo"),
            "id_u": form.get("id_u"),
            "duracion_t": form.get("duracion_t"),
            "detalles": details,
        }
        try:
            payload = PermisoIn.model_validate(data)
        except ValidationError as exc:
            _raise_validation_error(exc)
        return payload, document if isinstance(document, UploadFile) else None
    try:
        return PermisoIn.model_validate(await request.json()), None
    except ValidationError as exc:
        _raise_validation_error(exc)


async def _worker_permission_payload(request: Request) -> tuple[PermisoTrabajadorIn, UploadFile | None]:
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        try:
            return PermisoTrabajadorIn.model_validate(await request.json()), None
        except ValidationError as exc:
            _raise_validation_error(exc)
    form = await request.form()
    raw_details = form.get("detalles")
    if not isinstance(raw_details, str):
        raise AppError("Faltan detalles", 400)
    try:
        details = json.loads(raw_details)
    except json.JSONDecodeError as exc:
        raise AppError("El campo detalles no contiene JSON válido", 400) from exc
    document = form.get("documento")
    try:
        payload = PermisoTrabajadorIn.model_validate(
            {
                "id_t": form.get("id_t"),
                "tipo": form.get("tipo"),
                "duracion_t": form.get("duracion_t"),
                "detalles": details,
            }
        )
    except ValidationError as exc:
        _raise_validation_error(exc)
    return payload, document if isinstance(document, UploadFile) else None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(request: Request, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    if user.tipo != "usuario":
        raise AppError("No autorizado", 403)
    payload, document = await _permission_payload(request)
    data = await service.create_user_permission(db, payload, user.id, document)
    return {
        "success": True,
        "message": f"Permiso {payload.tipo.lower()} {str(data['estado']).lower()} exitosamente",
        "data": data,
    }


@router.get("/")
async def list_all(db: DBSession, _admin: Admin, estado: str | None = Query(default=None)) -> dict[str, Any]:
    return {"success": True, "data": await service.list_permissions(db, estado)}


@router.get("/bloqueados-detalle")
async def blocked_details(db: DBSession, _user: AuthenticatedUser) -> dict[str, Any]:
    return {"success": True, "data": await service.blocked_details(db)}


@router.get("/aceptado-detalle")
async def accepted_details(db: DBSession, _staff: Staff) -> dict[str, Any]:
    return {"success": True, "data": await service.accepted_details(db)}


@router.get("/aceptado")
async def accepted(db: DBSession, _staff: Staff) -> dict[str, Any]:
    return {"success": True, "data": await service.accepted_future(db)}


@router.get("/detalles/{permission_id}")
async def details(permission_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    owner = user.id if user.tipo == "usuario" else None
    return {"success": True, "data": await service.get_details(db, permission_id, owner)}


@router.put("/{permission_id}/estado")
async def update_status(
    permission_id: int, payload: EstadoPermisoIn, db: DBSession, admin: Admin
) -> dict[str, Any]:
    return await service.update_status(db, permission_id, payload.estado, admin.id)


@router.get("/{permission_id}/documento")
async def document(permission_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    owner = user.id if user.tipo == "usuario" else None
    url = await service.get_document(db, permission_id, owner)
    return {"success": True, "message": "Documento encontrado", "url_drive": url}


@router.get("/usuario/{user_id}")
async def by_user(user_id: int, db: DBSession, user: AuthenticatedUser) -> dict[str, Any]:
    if user.tipo == "usuario" and user.id != user_id:
        raise AppError("No autorizado para consultar estos permisos", 403)
    return {"success": True, "data": await service.by_user(db, user_id)}


@router.post("/trabajador", status_code=status.HTTP_201_CREATED)
async def create_worker(request: Request, db: DBSession, admin: Admin) -> dict[str, Any]:
    payload, document = await _worker_permission_payload(request)
    return {
        "success": True,
        "message": "Permiso registrado correctamente",
        "data": await service.create_worker_permission(db, payload, admin.id, document),
    }
