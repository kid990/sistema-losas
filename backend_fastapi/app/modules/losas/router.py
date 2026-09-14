from typing import Any

from fastapi import APIRouter, status

from app.core.database import DBSession
from app.modules.losas import service
from app.modules.losas.schemas import LosaIn

router = APIRouter(prefix="/losas", tags=["Losas"])


@router.get("/")
async def list_all(db: DBSession) -> list[dict[str, Any]]:
    return await service.list_all(db)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create(payload: LosaIn, db: DBSession) -> dict[str, int]:
    return {"id": await service.create(db, payload)}


@router.put("/{item_id}")
async def update_one(item_id: int, payload: LosaIn, db: DBSession) -> dict[str, str]:
    await service.update_one(db, item_id, payload)
    return {"mensaje": "Losa actualizada"}


@router.delete("/{item_id}")
async def delete_one(item_id: int, db: DBSession) -> dict[str, str]:
    await service.delete_one(db, item_id)
    return {"mensaje": "Losa eliminada"}


@router.get("/losas-detalles/{item_id}")
async def get_details(item_id: int, db: DBSession) -> dict[str, Any]:
    return await service.get_details(db, item_id)
