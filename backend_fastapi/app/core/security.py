import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Annotated, Any
from uuid import uuid4

import bcrypt
import jwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from jwt import InvalidTokenError

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: int
    rol: str
    tipo: str
    nombre: str
    codigo: str | None = None
    email: str | None = None


async def hash_password(password: str) -> str:
    """Calcula bcrypt fuera del event loop."""
    return await asyncio.to_thread(
        lambda: bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()
    )


async def verify_password(password: str, password_hash: str) -> bool:
    try:
        return await asyncio.to_thread(bcrypt.checkpw, password.encode(), password_hash.encode())
    except ValueError:
        return False


def hash_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def create_tokens(payload: dict[str, Any]) -> tuple[str, str]:
    now = datetime.now(UTC)
    access_payload = {
        **payload,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    refresh_payload = {
        "user_id": payload["id"],
        "user_type": payload["tipo"],
        "type": "refresh",
        "jti": str(uuid4()),
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_ttl_days),
    }
    return (
        jwt.encode(access_payload, settings.jwt_secret, algorithm="HS256"),
        jwt.encode(refresh_payload, settings.jwt_refresh_secret, algorithm="HS256"),
    )


def decode_refresh_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_refresh_secret, algorithms=["HS256"])
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Refresh token inválido o expirado") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")
    return payload


async def get_current_user(
    access_token: Annotated[str | None, Cookie(alias="accessToken")] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    token = access_token
    if not token and authorization:
        token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token requerido",
            headers={"X-Error-Code": "AUTH_TOKEN_REQUIRED"},
        )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return CurrentUser(
            id=int(payload["id"]),
            rol=str(payload["rol"]),
            tipo=str(payload["tipo"]),
            nombre=str(payload.get("nombre", "")),
            codigo=payload.get("codigo"),
            email=payload.get("email"),
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"X-Error-Code": "TOKEN_EXPIRED"},
        ) from exc
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc


AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]


def require_roles(*roles: str) -> Any:
    async def checker(user: AuthenticatedUser) -> CurrentUser:
        if user.rol not in roles:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")
        return user

    return checker
