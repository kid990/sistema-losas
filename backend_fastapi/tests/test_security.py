import pytest
from fastapi import HTTPException

from app.core.security import create_tokens, get_current_user, hash_password, verify_password


@pytest.mark.asyncio
async def test_bcrypt_is_compatible() -> None:
    password_hash = await hash_password("secreto123")
    assert await verify_password("secreto123", password_hash)
    assert not await verify_password("incorrecta", password_hash)


def test_access_and_refresh_tokens_are_different() -> None:
    access, refresh = create_tokens({"id": 1, "nombre": "Usuario", "rol": "Alumno", "tipo": "usuario"})
    assert access != refresh


@pytest.mark.asyncio
async def test_missing_access_token_requests_refresh() -> None:
    with pytest.raises(HTTPException) as error:
        await get_current_user(None, None)

    assert error.value.status_code == 401
    assert error.value.detail == "Token requerido"
    assert error.value.headers == {"X-Error-Code": "AUTH_TOKEN_REQUIRED"}
