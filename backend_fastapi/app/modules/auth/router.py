from typing import Annotated, Any, Literal

from fastapi import APIRouter, Cookie, Request, Response

from app.core.config import settings
from app.core.database import DBSession
from app.modules.auth import service
from app.modules.auth.schemas import (
    ForgotPasswordIn,
    LoginTrabajadorIn,
    LoginUsuarioIn,
    ResetPasswordIn,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    same_site: Literal["lax", "strict"] = "strict" if settings.is_production else "lax"
    response.set_cookie(
        "accessToken",
        access,
        max_age=settings.access_token_ttl_minutes * 60,
        httponly=True,
        secure=settings.is_production,
        samesite=same_site,
        path="/",
    )
    response.set_cookie(
        "refreshToken",
        refresh,
        max_age=settings.refresh_token_ttl_days * 86400,
        httponly=True,
        secure=settings.is_production,
        samesite=same_site,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("accessToken", path="/")
    response.delete_cookie("refreshToken", path="/")
    response.delete_cookie("refreshToken", path="/api/auth")


@router.post("/login/usuario")
async def login_usuario(
    payload: LoginUsuarioIn, request: Request, response: Response, db: DBSession
) -> dict[str, Any]:
    result = await service.login_usuario(
        db,
        payload.codigo,
        payload.password,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return {
        "message": "Login exitoso",
        "expiresIn": result.expires_in,
        "user": result.user.model_dump(exclude_none=True),
    }


@router.post("/login/trabajador")
async def login_trabajador(
    payload: LoginTrabajadorIn, request: Request, response: Response, db: DBSession
) -> dict[str, Any]:
    result = await service.login_trabajador(
        db,
        str(payload.email),
        payload.password,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return {
        "message": "Login exitoso",
        "expiresIn": result.expires_in,
        "user": result.user.model_dump(exclude_none=True),
    }


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: DBSession,
    refresh_token: Annotated[str | None, Cookie(alias="refreshToken")] = None,
) -> dict[str, Any]:
    result = await service.refresh(
        db, refresh_token, request.headers.get("user-agent"), request.client.host if request.client else None
    )
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return {"message": "Tokens renovados", "expiresIn": result.expires_in}


@router.post("/logout")
async def logout(
    response: Response,
    db: DBSession,
    refresh_token: Annotated[str | None, Cookie(alias="refreshToken")] = None,
) -> dict[str, str]:
    await service.logout(db, refresh_token)
    _clear_auth_cookies(response)
    return {"message": "Sesión cerrada exitosamente"}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn, db: DBSession) -> dict[str, str]:
    await service.forgot_password(db, payload.identifier)
    return {"message": "Si el usuario existe, recibirás un correo con las instrucciones."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordIn, db: DBSession) -> dict[str, str]:
    await service.reset_password(db, payload.token, payload.newPassword)
    return {"message": "Contraseña actualizada exitosamente. Vuelve a iniciar sesión."}
