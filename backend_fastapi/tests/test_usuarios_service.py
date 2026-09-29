from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.usuarios import service


@pytest.mark.asyncio
async def test_list_all_does_not_call_unheval_when_there_are_no_local_users(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = AsyncMock(spec=AsyncSession)
    result = MagicMock()
    result.all.return_value = []
    db.scalars.return_value = result
    list_usuarios = AsyncMock()
    monkeypatch.setattr(service, "list_usuarios", list_usuarios)

    assert await service.list_all(db) == []
    list_usuarios.assert_not_awaited()
