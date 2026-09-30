# Backend FastAPI — Sistema Losa

Migración del backend Express/MySQL a FastAPI/PostgreSQL. Conserva los prefijos y formatos de respuesta
utilizados por el frontend actual (`/api/auth`, `/api/permisos`, etc.).

## Arquitectura

Es un **monolito modular por dominio**. Cada módulo contiene su router HTTP, schemas Pydantic y servicio de
aplicación. La infraestructura compartida vive en `app/core`, los modelos SQLAlchemy en `app/models.py` y
las integraciones externas en `app/integrations`.

```text
HTTP -> router -> schema -> service -> AsyncSession -> PostgreSQL
                         -> integrations -> UNHEVAL / RENIEC / S3 / SMTP
```

La decisión completa está en `docs/adr/0001-monolito-modular-fastapi.md`.

## Instalación en Windows

```powershell
Copy-Item .env.example .env
.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 3000 --reload
```

Antes de iniciar, edita `DATABASE_URL` en `.env` con la contraseña real del usuario PostgreSQL. La base debe
llamarse `losa` y debe contener el esquema ubicado en `../PG/sistema_losa_schema.sql`.

Documentación interactiva:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI: `http://localhost:3000/openapi.json`
- Salud: `http://localhost:3000/health`

## Crear el administrador inicial

Con PostgreSQL configurado en `.env`, ejecuta una sola vez:

```powershell
.venv\Scripts\Activate.ps1
python scripts/create_admin.py
```

El comando solicita los datos y la contraseña de forma interactiva. La contraseña no se muestra ni se
guarda en texto plano: únicamente se almacena su hash bcrypt. Si el DNI o el correo ya existen, la
operación se cancela sin modificar la cuenta existente.

## Verificación

```powershell
python -m pytest
python -m ruff check app tests
python -m mypy app
```

Para comprobar la conexión real con S3/Backblaze B2, incluyendo subida, URL firmada y limpieza del
archivo temporal:

```powershell
.\.venv\Scripts\python.exe scripts\verify_s3.py
```

## Reportes PDF almacenados

Antes de usar reportes en una base existente, crea la tabla de metadatos:

```powershell
.\.venv\Scripts\python.exe scripts\migrate_reports.py
```

Cada reporte mensual o anual se genera una sola vez, se guarda bajo el prefijo S3 configurado en
`S3_REPORT_KEY_PREFIX` (por defecto `reportes`) y se registra en `reportes_generados`. Las siguientes
consultas del mismo periodo descargan el PDF existente desde S3 sin volver a invocar la IA.
