from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=10,
)
session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Proporciona una sesión y garantiza rollback ante errores."""
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


DBSession = Annotated[AsyncSession, Depends(get_db)]
