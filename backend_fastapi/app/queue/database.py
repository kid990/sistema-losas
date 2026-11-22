from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings


@asynccontextmanager
async def task_session() -> AsyncIterator[AsyncSession]:
    """Crea una sesión aislada del event loop usado por el servidor web."""
    task_engine = create_async_engine(
        settings.sqlalchemy_database_url,
        connect_args={"ssl": settings.database_ssl_mode},
        pool_pre_ping=True,
        poolclass=NullPool,
    )
    factory = async_sessionmaker(task_engine, expire_on_commit=False, autoflush=False)
    try:
        async with factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
    finally:
        await task_engine.dispose()
