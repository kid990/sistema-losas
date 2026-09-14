from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.database import DBSession
from app.core.security import CurrentUser, require_roles
from app.modules.imagenes import service

router = APIRouter(prefix="/imagenes", tags=["Imágenes"])
Admin = Annotated[CurrentUser, Depends(require_roles("Administrador"))]


@router.post("/upload")
async def upload(
    db: DBSession,
    _admin: Admin,
    imagen: Annotated[UploadFile, File()],
    id_l: Annotated[int, Form()],
) -> dict[str, str]:
    url = await service.upload(db, imagen, id_l)
    return {"message": "Imagen guardada correctamente", "url": url}


@router.get("/")
async def list_all(db: DBSession) -> list[dict[str, Any]]:
    return await service.list_all(db)


@router.delete("/{image_id}")
async def delete_one(image_id: int, db: DBSession, _admin: Admin) -> dict[str, str]:
    await service.delete_one(db, image_id)
    return {"message": "Imagen eliminada correctamente"}
