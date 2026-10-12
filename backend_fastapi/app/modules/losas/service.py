import asyncio
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.serialization import model_dict
from app.integrations.storage import signed_stored_object_url
from app.models import Disciplina, Imagen, Losa
from app.modules.losas.schemas import LosaIn


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Losa, Disciplina.nombre.label("nombre_disciplina"))
        .join(Disciplina, Losa.id_d == Disciplina.id_d)
        .order_by(Losa.id_l)
    )
    return [{**model_dict(losa), "nombre_disciplina": disciplina} for losa, disciplina in result.all()]


async def list_all_with_details(db: AsyncSession) -> list[dict[str, Any]]:
    """Carga todas las losas con su disciplina e imágenes firmadas en solo 2 queries."""
    result = await db.execute(
        select(Losa, Disciplina.nombre.label("nombre_disciplina"))
        .join(Disciplina, Losa.id_d == Disciplina.id_d)
        .order_by(Losa.id_l)
    )
    court_rows = result.all()
    if not court_rows:
        return []

    court_ids = [losa.id_l for losa, _ in court_rows]
    image_rows = (await db.scalars(select(Imagen).where(Imagen.id_l.in_(court_ids)))).all()

    # Pre-firmar todas las imágenes en paralelo
    signed_urls = await asyncio.gather(*(signed_stored_object_url(img.url) for img in image_rows))
    images_by_court: dict[int, list[dict[str, Any]]] = {cid: [] for cid in court_ids}
    for img, signed_url in zip(image_rows, signed_urls, strict=True):
        images_by_court[img.id_l].append({
            "id_img": img.id_img,
            "nombre_imagen": img.nombre,
            "foto": signed_url,
        })

    return [
        {
            **model_dict(losa),
            "nombre_disciplina": disc,
            "imagenes": images_by_court.get(losa.id_l, []),
        }
        for losa, disc in court_rows
    ]


async def create(db: AsyncSession, payload: LosaIn) -> int:
    data = payload.model_dump()
    data["estado"] = data["estado"] or "Disponible"
    item = Losa(**data)
    db.add(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("Número de losa duplicado o disciplina inválida", 409) from exc
    await db.refresh(item)
    return item.id_l


async def update_one(db: AsyncSession, item_id: int, payload: LosaIn) -> None:
    item = await db.get(Losa, item_id)
    if item is None:
        raise AppError("Losa no encontrada", 404)
    for key, value in payload.model_dump(exclude={"estado"}).items():
        setattr(item, key, value)
    if payload.estado is not None:
        item.estado = payload.estado
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("Número de losa duplicado o disciplina inválida", 409) from exc


async def delete_one(db: AsyncSession, item_id: int) -> None:
    item = await db.get(Losa, item_id)
    if item is None:
        raise AppError("Losa no encontrada", 404)
    await db.delete(item)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError("No se puede eliminar porque tiene registros relacionados", 409) from exc


async def get_details(db: AsyncSession, item_id: int) -> dict[str, Any]:
    item = await db.get(Losa, item_id)
    if item is None:
        raise AppError("Losa no encontrada", 404)
    disciplina = await db.get(Disciplina, item.id_d)
    images = (await db.scalars(select(Imagen).where(Imagen.id_l == item.id_l))).all()
    signed_urls = await asyncio.gather(*(signed_stored_object_url(image.url) for image in images))
    return {
        **model_dict(item),
        "nombre_disciplina": disciplina.nombre if disciplina else "Sin disciplina",
        "imagenes": [
            {"id_img": image.id_img, "nombre_imagen": image.nombre, "foto": signed_url}
            for image, signed_url in zip(images, signed_urls, strict=True)
        ],
    }
