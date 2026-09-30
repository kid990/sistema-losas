# SIRLOD — Sistema de Reservas de Losas Deportivas

Sistema web de la Universidad Nacional Hermilio Valdizán para administrar losas deportivas, horarios, permisos normales y especiales, usuarios, notificaciones, reportes y revisión automática basada en reglas.

Esta guía está orientada a desarrollo local en Windows con PowerShell.

## Arquitectura actual

| Servicio | Carpeta | Tecnología | Puerto |
|---|---|---|---:|
| Frontend SSR | `frontend/` | React 19 + React Router 8 + TypeScript | 5173 |
| API principal | `backend_fastapi/` | FastAPI + SQLAlchemy async + PostgreSQL | 3000 |
| Padrón UNHEVAL | `backend_api/` | Express + MySQL | 3001 |

Flujo principal:

```text
Navegador -> React Router (5173) -> FastAPI (3000) -> PostgreSQL (losa)
                                      |
                                      +-> API UNHEVAL (3001) -> MySQL (api_unheval)
                                      +-> Gemini / S3 / SMTP / RENIEC
```

El antiguo backend Express del sistema principal ya no se utiliza. `backend_api` sí debe conservarse porque proporciona el padrón académico.

## Requisitos

- Git.
- Python 3.11 o superior.
- Node.js 22 o superior.
- pnpm: `npm install -g pnpm`.
- PostgreSQL 15 o superior.
- MySQL 8 o superior.
- Opcional: pgAdmin y MySQL Workbench.

Comprueba las instalaciones:

```powershell
git --version
python --version
node --version
pnpm --version
```

## Instalación desde cero

### 1. Clonar el repositorio

```powershell
git clone URL_DEL_REPOSITORIO
cd SISTEMA_LOSA
```

### 2. Crear PostgreSQL

La base principal debe llamarse `losa`.

Con `psql` disponible:

```powershell
createdb -U postgres losa
psql -U postgres -d losa -f .\PG\sistema_losa_schema.sql
psql -U postgres -d losa -f .\PG\migrations\001_integridad_permisos.sql
psql -U postgres -d losa -f .\PG\migrations\20260929_permissions_audit.sql
```

Alternativa con pgAdmin:

1. Crea una base llamada `losa` con codificación UTF-8.
2. Abre **Query Tool** conectado a `losa`.
3. Ejecuta `PG/sistema_losa_schema.sql`.
4. Ejecuta, en orden, los archivos de `PG/migrations/`.

Los scripts de migración son idempotentes: pueden ejecutarse de nuevo sin duplicar las columnas auditadas.

### 3. Crear MySQL para el padrón UNHEVAL

Desde MySQL Workbench crea una base llamada `api_unheval` y ejecuta:

1. `DB/api_unheval_schema.sql`.
2. `DB/api_unheval_data.sql`.

También puedes hacerlo desde consola:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS api_unheval CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p --database=api_unheval --execute="source DB/api_unheval_schema.sql"
mysql -u root -p --database=api_unheval --execute="source DB/api_unheval_data.sql"
```

### 4. Instalar FastAPI

```powershell
cd backend_fastapi
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Si PowerShell bloquea la activación del entorno virtual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Edita `backend_fastapi/.env`. Configuración mínima:

```env
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=TU_CLAVE_POSTGRES
POSTGRES_DB=losa

JWT_SECRET=UNA_CLAVE_LARGA_Y_ALEATORIA
JWT_REFRESH_SECRET=OTRA_CLAVE_LARGA_Y_ALEATORIA

FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=["http://localhost:5173"]
UNHEVAL_API_URL=http://localhost:3001/api

GEMINI_API_KEY=TU_CLAVE_GEMINI
GEMINI_MODEL=gemini-3.8-flash
```

No subas `.env` a Git. El repositorio solo debe contener `.env.example` sin secretos.

Aplica la migración de auditoría y verifica la base:

```powershell
.\.venv\Scripts\python.exe scripts\migrate_permissions_audit.py
.\.venv\Scripts\python.exe scripts\check_database.py
```

Para crear el primer administrador:

```powershell
.\.venv\Scripts\python.exe scripts\create_admin.py
```

### 5. Instalar la API del padrón

Desde la raíz:

```powershell
cd backend_api
pnpm install
Copy-Item .env.example .env
```

Edita `backend_api/.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=TU_CLAVE_MYSQL
DB_NAME=api_unheval
PORT=3001
```

### 6. Instalar el frontend

Desde la raíz:

```powershell
cd frontend
pnpm install
Copy-Item .env.example .env
```

Contenido mínimo de `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Cómo ejecutar el sistema

Abre tres terminales de PowerShell en la carpeta raíz `SISTEMA_LOSA`. Cada servicio se inicia por separado.

### Terminal 1 — Padrón UNHEVAL

```powershell
cd backend_api
pnpm dev
```

Verificación: `http://localhost:3001/api/test`.

### Terminal 2 — FastAPI

```powershell
cd backend_fastapi
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 3000 --reload
```

Verificaciones:

- Salud: `http://localhost:3000/health`.
- Preparación y PostgreSQL: `http://localhost:3000/ready`.
- Swagger: `http://localhost:3000/docs`.

### Terminal 3 — Frontend

```powershell
cd frontend
pnpm dev
```

Abre `http://localhost:5173`.

## Comandos de desarrollo

### FastAPI

```powershell
cd backend_fastapi
.\.venv\Scripts\Activate.ps1

python -m pytest
python -m ruff check app tests scripts
python -m mypy app
python -m compileall app
python scripts\check_database.py
```

### Frontend

```powershell
cd frontend

pnpm run typecheck
pnpm run build
pnpm start
```

### API UNHEVAL

```powershell
cd backend_api

pnpm dev
```

## Verificar PostgreSQL

Ejecuta:

```powershell
cd backend_fastapi
.\.venv\Scripts\python.exe scripts\check_database.py
```

El verificador compara las tablas y columnas existentes con los modelos SQLAlchemy. Termina con código 1 si falta alguna tabla o columna.

Estado verificado localmente el 30 de septiembre de 2026:

```text
Esquema completo: 13 tablas de aplicación verificadas
- configuracion_global: 1 registro
- disciplinas: 5 registros
- losas: 5 registros
- users: 91 registros
- trabajadores: 1 registro
```

Por tanto, la base PostgreSQL activa está completa respecto a los modelos actuales. El script también permite volver a comprobarla después de clonar, migrar o desplegar.

Para hacer una copia de seguridad antes de cambios importantes:

```powershell
New-Item -ItemType Directory -Force ..\SISTEMA_LOSA_backups
pg_dump -U postgres -d losa -F c -f ..\SISTEMA_LOSA_backups\losa.backup
```

El respaldo queda fuera del repositorio para que `git add -A` no lo incluya por accidente.

## Funciones principales

- Inicio de sesión para alumnos, docentes, administradores y seguridad.
- Reservas normales y permisos especiales con PDF.
- Revisión automática de permisos especiales mediante reglas auditables.
- Análisis del PDF con Gemini: valida estudiante UNHEVAL, actividad permitida, firma y coincidencia
  de fecha y horario antes de aceptar un permiso especial.
- Reportes mensuales y anuales.
- LosaBot con Gemini y respuestas locales de respaldo.
- Gestión de losas, disciplinas, imágenes, usuarios y trabajadores.
- Horarios configurables y días bloqueados.
- Notificaciones, almacenamiento S3 y recuperación de contraseña.

## Estructura útil

```text
SISTEMA_LOSA/
├── backend_fastapi/       # API principal y pruebas
│   ├── app/
│   ├── scripts/
│   └── tests/
├── backend_api/           # Padrón UNHEVAL/MySQL
├── frontend/              # React Router SSR
├── PG/                    # Esquema y migraciones PostgreSQL
├── DB/                    # Esquema y datos del padrón MySQL
└── README.md
```

## Cómo subir las eliminaciones a GitHub

Cuando borras archivos localmente, GitHub no cambia hasta que registres y envíes esas eliminaciones con Git.

Desde la raíz del proyecto:

```powershell
git status --short
git branch --show-current
git add -A
git diff --cached --stat
git status --short
git commit -m "Migra backend a FastAPI y elimina código obsoleto"
git push origin main
```

`git add -A` es importante porque agrega archivos nuevos, modificaciones y eliminaciones. Si tu rama no se llama `main`, reemplázala por el resultado de:

```powershell
git branch --show-current
```

Ejemplo:

```powershell
$branch = git branch --show-current
git push origin $branch
```

Antes del commit revisa exactamente lo que se eliminará:

```powershell
git diff --cached --name-status
git diff --cached --diff-filter=D --name-only
```

Después del `push`, los archivos eliminados desaparecerán de la rama correspondiente en GitHub, pero seguirán recuperables desde el historial de Git.

## Actualizar una instalación existente

```powershell
git pull

cd backend_fastapi
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python scripts\migrate_permissions_audit.py
python scripts\check_database.py

cd ..\backend_api
pnpm install

cd ..\frontend
pnpm install
pnpm run typecheck
pnpm run build
```

Reinicia los tres servicios después de actualizar.

## Problemas frecuentes

### La tabla de horarios aparece sin losas

Comprueba que PostgreSQL tenga disciplinas y losas:

```powershell
cd backend_fastapi
.\.venv\Scripts\python.exe scripts\check_database.py
```

### Usuarios tarda o aparece vacío

Comprueba `http://localhost:3001/api/test` y que MySQL tenga la base `api_unheval`. Después usa **Sincronizar Padrón** desde el panel administrador.

### LosaBot responde en modo local

Configura `GEMINI_API_KEY` en `backend_fastapi/.env` y reinicia FastAPI. La respuesta del endpoint `/api/chatbot/` indicará `source: gemini` cuando la integración esté activa.

### FastAPI no conecta con PostgreSQL

Revisa `POSTGRES_PASSWORD`, `POSTGRES_DB=losa` y que PostgreSQL esté iniciado. Consulta también `http://localhost:3000/ready`.

### El puerto está ocupado

```powershell
netstat -ano | Select-String ':3000|:3001|:5173'
```

Detén únicamente el proceso que corresponda o cambia el puerto en su `.env`.

## Seguridad

- No subas `.env`, claves Gemini, credenciales PostgreSQL/MySQL ni secretos JWT.
- Usa contraseñas distintas en producción.
- Haz una copia de PostgreSQL antes de aplicar migraciones.
- Revisa `git diff --cached` antes de cada commit.
