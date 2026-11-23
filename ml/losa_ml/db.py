"""Conexión a PostgreSQL para los scripts offline.

La contraseña del `.env.docker` contiene un `?` sin codificar. Un DSN crudo
rompe en `asyncpg`/`libpq`, así que aquí se arma la conexión con parámetros
separados en lugar de pegar la URL.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import psycopg

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV = REPO_ROOT / "backend_fastapi" / ".env.docker"


def read_env_file(path: Path = DEFAULT_ENV) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or read_env_file().get("DATABASE_URL", "")
    if not url:
        raise SystemExit("Falta DATABASE_URL (variable de entorno o backend_fastapi/.env.docker)")
    return url


def connection_kwargs(url: str | None = None) -> dict[str, object]:
    url = url or database_url()
    if "://" not in url:
        raise SystemExit("DATABASE_URL inválida: falta el esquema postgresql://")
    rest = url.split("://", 1)[1]
    if "@" not in rest:
        raise SystemExit("DATABASE_URL inválida: faltan las credenciales")
    creds, hostpart = rest.rsplit("@", 1)
    user, _, password = creds.partition(":")
    hostport, _, database = hostpart.partition("/")
    database = database.split("?", 1)[0]
    host, _, port = hostport.rpartition(":")
    if not host:
        host, port = hostport, "5432"
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": int(port or 5432),
        "dbname": database or "postgres",
        "sslmode": "require",
        "connect_timeout": 20,
        "options": "-c statement_timeout=120000 -c lock_timeout=15000",
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
        "application_name": "sirlod-ml",
    }


def connect(attempts: int = 3) -> psycopg.Connection:
    """Abre la conexión reintentando si el pooler de Supabase la corta."""
    kwargs = connection_kwargs()
    ultimo: Exception | None = None
    for intento in range(attempts):
        try:
            return psycopg.connect(**kwargs)  # type: ignore[arg-type]
        except psycopg.OperationalError as exc:
            ultimo = exc
            if intento < attempts - 1:
                time.sleep(1.5 * (intento + 1))
    raise ultimo  # type: ignore[misc]


def describe_target() -> str:
    kwargs = connection_kwargs()
    return f"{kwargs['host']}:{kwargs['port']}/{kwargs['dbname']} (user={kwargs['user']})"
