import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.responses import Response

from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import AppError
from app.core.rate_limit import limiter
from app.modules.auth.router import router as auth_router
from app.modules.configuracion.router import router as configuracion_router
from app.modules.dias_bloqueados.router import router as dias_router
from app.modules.disciplinas.router import router as disciplinas_router
from app.modules.imagenes.router import router as imagenes_router
from app.modules.losas.router import router as losas_router
from app.modules.notificaciones.router import router as notificaciones_router
from app.modules.permisos.router import router as permisos_router
from app.modules.reniec.router import router as reniec_router
from app.modules.trabajadores.router import router as trabajadores_router
from app.modules.usuarios.router import router as usuarios_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


def _global_rate_limit_key(request: Request) -> str:
    access_token = request.cookies.get("accessToken")
    if access_token:
        token_hash = sha256(access_token.encode()).hexdigest()
        return f"session:{token_hash}"
    client_ip = request.client.host if request.client else "unknown"
    return f"ip:{client_ip}"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Gestiona únicamente recursos; el esquema se administra con el SQL del directorio PG."""
    yield
    await engine.dispose()


app = FastAPI(
    title="Sistema de Gestión de Permisos Deportivos - UNHEVAL",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

origins = list(dict.fromkeys([*settings.cors_origins, settings.frontend_url]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    if not await limiter.hit(f"global:{_global_rate_limit_key(request)}", 600, 15 * 60):
        return JSONResponse(
            status_code=429,
            content={
                "message": "Demasiadas peticiones, intenta de nuevo en 15 minutos",
                "code": "RATE_LIMITED",
            },
            headers={"Retry-After": "900"},
        )
    login_path = request.url.path in {
        "/api/auth/login/usuario",
        "/api/auth/login/trabajador",
    }
    login_key = f"login:{client_ip}"
    if login_path and not await limiter.hit(login_key, 3, 15 * 60):
        return JSONResponse(
            status_code=429,
            content={
                "message": "Has superado el límite de 3 intentos fallidos. Intenta en 15 minutos.",
                "code": "LOGIN_RATE_LIMITED",
            },
        )
    response = await call_next(request)
    if login_path and response.status_code < 400:
        await limiter.clear(login_key)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    payload: dict[str, Any] = {"message": exc.message}
    if exc.code:
        payload["code"] = exc.code
    if exc.details is not None:
        payload["details"] = exc.details
    if exc.conflicts is not None:
        payload["conflicts"] = exc.conflicts
    return JSONResponse(status_code=exc.status_code, content=jsonable_encoder(payload))


@app.exception_handler(HTTPException)
async def http_error_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    payload: dict[str, Any] = {"message": str(exc.detail)}
    error_code = exc.headers.get("X-Error-Code") if exc.headers else None
    if error_code:
        payload["code"] = error_code
    return JSONResponse(status_code=exc.status_code, content=jsonable_encoder(payload))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"message": "Datos inválidos", "errors": exc.errors()}),
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Error no controlado", exc_info=exc)
    message = "Error interno del servidor" if settings.is_production else str(exc)
    return JSONResponse(status_code=500, content={"message": message, "code": "INTERNAL_ERROR"})


@app.get("/health", tags=["Sistema"])
async def health() -> dict[str, str]:
    return {"status": "OK", "timestamp": datetime.now(UTC).isoformat()}


@app.get("/ready", tags=["Sistema"])
async def ready() -> dict[str, str]:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return {"status": "READY"}


for router in (
    auth_router,
    trabajadores_router,
    usuarios_router,
    permisos_router,
    disciplinas_router,
    losas_router,
    imagenes_router,
    configuracion_router,
    dias_router,
    reniec_router,
    notificaciones_router,
):
    app.include_router(router, prefix="/api")
