from datetime import UTC, datetime, timedelta
from secrets import token_hex

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    create_tokens,
    decode_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.integrations.email import send_email
from app.integrations.unheval import get_usuario
from app.models import PasswordResetToken, Trabajador, User, UserSession
from app.modules.auth.schemas import LoginResult, PublicUser


def _utc_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def parse_user_agent(user_agent: str | None) -> dict[str, str]:
    result = {"device_name": "Ordenador", "browser": "Otro", "operating_system": "Otro"}
    if not user_agent:
        return result
    if "Chrome" in user_agent and "Edg" not in user_agent:
        result["browser"] = "Chrome"
    elif "Firefox" in user_agent:
        result["browser"] = "Firefox"
    elif "Safari" in user_agent and "Chrome" not in user_agent:
        result["browser"] = "Safari"
    elif "Edg" in user_agent:
        result["browser"] = "Edge"
    elif "OPR" in user_agent or "Opera" in user_agent:
        result["browser"] = "Opera"
    if "Windows" in user_agent:
        result["operating_system"] = "Windows"
    elif "Mac OS" in user_agent:
        result["operating_system"] = "macOS"
    elif "Linux" in user_agent and "Android" not in user_agent:
        result["operating_system"] = "Linux"
    elif "Android" in user_agent:
        result["operating_system"] = "Android"
    elif any(value in user_agent for value in ("iOS", "iPhone", "iPad")):
        result["operating_system"] = "iOS"
    if "Mobile" in user_agent or "Android" in user_agent:
        result["device_name"] = "Móvil"
    elif "iPad" in user_agent or "Tablet" in user_agent:
        result["device_name"] = "Tablet"
    return result


async def _store_session(
    db: AsyncSession,
    *,
    user_id: int,
    user_type: str,
    refresh_token: str,
    user_agent: str | None,
    ip_address: str | None,
) -> None:
    parsed = parse_user_agent(user_agent)
    db.add(
        UserSession(
            user_id=user_id,
            user_type=user_type,
            refresh_token_hash=hash_token(refresh_token),
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=_utc_naive() + timedelta(days=settings.refresh_token_ttl_days),
            **parsed,
        )
    )


async def login_usuario(
    db: AsyncSession, codigo: str, password: str, user_agent: str | None, ip_address: str | None
) -> LoginResult:
    user = await db.scalar(select(User).where(User.codigo == codigo).limit(1))
    if user is None or not await verify_password(password, user.password):
        raise AppError("Credenciales incorrectas", 401)
    if user.estado == "Inactivo":
        raise AppError("Tu cuenta está desactivada. Contacta al administrador.", 403)
    await db.execute(
        update(UserSession)
        .where(
            UserSession.user_id == user.id_u,
            UserSession.user_type == "usuario",
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=_utc_naive())
    )
    public = PublicUser(id=user.id_u, codigo=user.codigo, nombre=user.codigo, rol=user.rol, tipo="usuario")
    access, refresh = create_tokens(public.model_dump(exclude_none=True))
    await _store_session(
        db,
        user_id=user.id_u,
        user_type="usuario",
        refresh_token=refresh,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    await db.commit()
    return LoginResult(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_minutes * 60,
        user=public,
    )


async def login_trabajador(
    db: AsyncSession, email: str, password: str, user_agent: str | None, ip_address: str | None
) -> LoginResult:
    worker = await db.scalar(select(Trabajador).where(Trabajador.email == email).limit(1))
    if worker is None or not await verify_password(password, worker.password):
        raise AppError("Credenciales incorrectas", 401)
    if worker.estado == "Inactivo":
        raise AppError("Tu cuenta está desactivada. Contacta al administrador.", 403)
    await db.execute(
        update(UserSession)
        .where(
            UserSession.user_id == worker.id_t,
            UserSession.user_type == "trabajador",
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=_utc_naive())
    )
    public = PublicUser(
        id=worker.id_t,
        email=worker.email,
        nombre=worker.nombres,
        rol=worker.rol,
        tipo="trabajador",
    )
    access, refresh = create_tokens(public.model_dump(exclude_none=True))
    await _store_session(
        db,
        user_id=worker.id_t,
        user_type="trabajador",
        refresh_token=refresh,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    await db.commit()
    return LoginResult(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_minutes * 60,
        user=public,
    )


async def refresh(
    db: AsyncSession, token: str | None, user_agent: str | None, ip_address: str | None
) -> LoginResult:
    if not token:
        raise AppError("Refresh token requerido", 400)
    try:
        decoded = decode_refresh_token(token)
    except Exception as exc:
        raise AppError("Refresh token inválido o expirado", 401) from exc
    session = await db.scalar(
        select(UserSession).where(
            UserSession.refresh_token_hash == hash_token(token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > _utc_naive(),
        )
    )
    if session is None:
        raise AppError(
            "Sesión cerrada. Has iniciado sesión en otro dispositivo.",
            401,
            "SESSION_TERMINATED",
        )
    if session.user_id != int(decoded["user_id"]) or session.user_type != decoded["user_type"]:
        raise AppError("Sesión inválida", 401)
    session.revoked_at = _utc_naive()
    public: PublicUser
    if session.user_type == "usuario":
        user = await db.get(User, session.user_id)
        if user is None:
            raise AppError("Usuario no encontrado", 404)
        public = PublicUser(
            id=user.id_u, codigo=user.codigo, nombre=user.codigo, rol=user.rol, tipo="usuario"
        )
    else:
        worker = await db.get(Trabajador, session.user_id)
        if worker is None:
            raise AppError("Trabajador no encontrado", 404)
        public = PublicUser(
            id=worker.id_t,
            email=worker.email,
            nombre=worker.nombres,
            rol=worker.rol,
            tipo="trabajador",
        )
    access, new_refresh = create_tokens(public.model_dump(exclude_none=True))
    await _store_session(
        db,
        user_id=session.user_id,
        user_type=session.user_type,
        refresh_token=new_refresh,
        user_agent=user_agent or session.user_agent,
        ip_address=ip_address,
    )
    await db.commit()
    return LoginResult(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=settings.access_token_ttl_minutes * 60,
        user=public,
    )


async def logout(db: AsyncSession, token: str | None) -> None:
    if token:
        session = await db.scalar(
            select(UserSession).where(UserSession.refresh_token_hash == hash_token(token))
        )
        if session:
            session.revoked_at = _utc_naive()
            await db.commit()


async def forgot_password(db: AsyncSession, identifier: str) -> None:
    user_id: int | None = None
    user_type: str | None = None
    email: str | None = None
    name = "Usuario"
    if "@" in identifier:
        worker = await db.scalar(select(Trabajador).where(Trabajador.email == identifier))
        if worker:
            user_id, user_type, email, name = worker.id_t, "trabajador", worker.email, worker.nombres
    else:
        user = await db.scalar(select(User).where(User.codigo == identifier))
        if user:
            external = await get_usuario(user.codigo)
            user_id, user_type = user.id_u, "usuario"
            if external:
                email = external.get("email")
                name = external.get("nombre_completo") or external.get("nombres") or name
    if not user_id or not user_type or not email:
        return
    now = _utc_naive()
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.user_type == user_type,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw_token = token_hex(32)
    db.add(
        PasswordResetToken(
            user_id=user_id,
            user_type=user_type,
            token_hash=hash_token(raw_token),
            expires_at=now + timedelta(hours=1),
        )
    )
    await db.commit()
    link = f"{settings.frontend_url}/reset-password?token={raw_token}"
    await send_email(
        email,
        "Recuperación de contraseña - Sistema UNHEVAL",
        f"Hola {name},\n\nRestablece tu contraseña aquí: {link}\n\nExpira en 60 minutos.",
        f'<p>Hola <b>{name}</b>,</p><p><a href="{link}">Restablecer contraseña</a></p>',
    )


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    reset = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_token(token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > _utc_naive(),
        )
    )
    if reset is None:
        raise AppError("Token inválido o expirado", 401)
    new_hash = await hash_password(new_password)
    if reset.user_type == "usuario":
        user = await db.get(User, reset.user_id)
        if user is None:
            raise AppError("Usuario no encontrado", 404)
        user.password = new_hash
    else:
        worker = await db.get(Trabajador, reset.user_id)
        if worker is None:
            raise AppError("Trabajador no encontrado", 404)
        worker.password = new_hash
    now = _utc_naive()
    await db.execute(
        update(UserSession)
        .where(
            UserSession.user_id == reset.user_id,
            UserSession.user_type == reset.user_type,
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    reset.used_at = now
    await db.commit()
