import asyncio
from contextlib import suppress
from typing import Any

from fastapi import UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AppError
from app.integrations.storage import (
    delete_file,
    object_key,
    signed_download_url,
    signed_stored_object_url,
    upload_file,
)
from app.models import Imagen, Losa


async def upload(db: AsyncSession, image: UploadFile, losa_id: int) -> str:
    if losa_id <= 0 or await db.get(Losa, losa_id) is None:
        raise AppError("Falta el ID de la losa o no existe", 400)
    content = await image.read()
    if not content:
        raise AppError("No se subió ninguna imagen", 400)
    if len(content) > 5 * 1024 * 1024:
        raise AppError("La imagen no debe superar 5 MB", 413, "FILE_TOO_LARGE")
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    if not (
        (image.content_type == "image/jpeg" and is_jpeg)
        or (image.content_type == "image/png" and is_png)
    ):
        raise AppError("Solo se permiten imágenes JPG o PNG válidas", 400, "INVALID_IMAGE")
    stored = await upload_file(
        content,
        image.filename or "imagen",
        image.content_type or "application/octet-stream",
        settings.s3_image_key_prefix,
    )
    db.add(Imagen(nombre=image.filename or "imagen", url=stored.url, id_l=losa_id))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        with suppress(Exception):
            await delete_file(stored.key)
        raise
    return await signed_download_url(stored.key)


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Imagen, Losa.nombre.label("nombre_losa"))
        .outerjoin(Losa, Imagen.id_l == Losa.id_l)
        .order_by(Imagen.created_at.desc())
    )
    rows = result.all()
    signed_urls = await asyncio.gather(*(signed_stored_object_url(image.url) for image, _ in rows))
    return [
        {
            "id_img": image.id_img,
            "nombre_imagen": image.nombre,
            "nombre_losa": losa_name,
            "id_l": image.id_l,
            "foto": signed_url,
        }
        for (image, losa_name), signed_url in zip(rows, signed_urls, strict=True)
    ]


async def delete_one(db: AsyncSession, image_id: int) -> None:
    image = await db.get(Imagen, image_id)
    if image is None:
        raise AppError("Imagen no encontrada", 404)
    key = object_key(image.url)
    if key:
        await delete_file(key)
    await db.execute(delete(Imagen).where(Imagen.id_img == image_id))
    await db.commit()
