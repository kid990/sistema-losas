# 🏟️ Sistema de Gestión de Losas Deportivas - UNHEVAL

Sistema integral para la administración de permisos de uso de losas deportivas en la **Universidad Nacional Hermilio Valdizán (UNHEVAL)**. Permite a estudiantes, docentes y personal administrativo solicitar, gestionar y dar seguimiento a reservas de espacios deportivos de forma digital.

## 🚀 Tecnologías

### Backend (`backend/`)
| Tecnología | Versión |
|---|---|
| **Node.js** | 22+ |
| **Express** | 5.x |
| **MySQL** | 8.x (con `mysql2/promise`) |
| **JWT dual-token** | Access (15 min) + Refresh (7d) en cookies httpOnly |
| **S3-compatible** | Backblaze B2 / MinIO (`@aws-sdk/client-s3`) |
| **Multer** | Subida de archivos en memoria |
| **Nodemailer** | Envío de correos transaccionales (SMTP) |
| **Zod** | Validación de entrada |
| **express-rate-limit** | Rate limiting |
| **Helmet** | Security headers |

### Frontend (`frontend/`)
| Tecnología | Versión |
|---|---|
| **React** | 19.x |
| **React Router** | 8.x (con SSR) |
| **TypeScript** | 5.x (strict mode) |
| **Tailwind CSS** | 4.x |
| **Vite** | 8.x |
| **react-data-table-component** | Tablas interactivas |
| **SweetAlert2** | Modales y notificaciones |
| **react-icons** | Iconografía |

### API Externa (`backend_api/`)
| Tecnología | Descripción |
|---|---|
| **Express** | Proxy API para consultar datos UNHEVAL (puerto 3001) |

## 📋 Requisitos

- **Node.js** 22 o superior
- **MySQL** 8+
- **pnpm** (recomendado) o npm

## 🛠️ Instalación

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd SISTEMA_LOSA
```

### 2. Base de datos

Ejecutar los scripts SQL en tu servidor MySQL en este orden:

```bash
# Esquema y datos del sistema principal
mysql -u root -p < DB/sistema_losa_schema.sql
mysql -u root -p < DB/sistema_losa_data.sql

# (Opcional) Esquema y datos de la API externa UNHEVAL
mysql -u root -p < DB/api_unheval_schema.sql
mysql -u root -p < DB/api_unheval_data.sql
```

> **Nota:** `sistema_losa_data.sql` incluye datos de prueba como disciplinas, losas, trabajadores administrador y seguridad. Además, los datos de permisos, notificaciones e imágenes vienen limpios para empezar desde cero.

### 3. Backend

```bash
cd backend

# Instalar dependencias (se recomienda pnpm, también funciona npm)
pnpm install

# Crear archivo de configuración
cp .env.example .env
```

Editar `backend/.env` con tus credenciales (ver sección completa abajo).

Luego inicia el servidor:

```bash
pnpm run dev
```

El backend se ejecutará en `http://localhost:3000`. Verifica con `http://localhost:3000/health`.

### 4. Frontend

```bash
cd frontend

# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

El frontend se ejecutará en `http://localhost:5173`.

### 5. API UNHEVAL (opcional)

```bash
cd backend_api
pnpm install
node index.js
```

Proxy API para consultar datos de la universidad en `http://localhost:3001`.

## 🌐 Estructura del proyecto

```
SISTEMA_LOSA/
├── backend/                     # 🖥️ API REST (Express 5 + MySQL)
│   ├── config/
│   │   └── db.js               # Pool de conexiones MySQL2
│   ├── modules/                 # 🏗️ Arquitectura modular por dominio
│   │   ├── auth/                # Login, refresh, logout
│   │   ├── configuracion/       # Configuración del sistema
│   │   ├── dias_bloqueados/     # Días feriados/bloqueados
│   │   ├── disciplinas/         # Disciplinas deportivas
│   │   ├── imagenes/            # Imágenes (S3-compatible)
│   │   ├── losas/               # Losas deportivas
│   │   ├── notificaciones/      # Notificaciones del sistema
│   │   ├── permisos/            # Permisos + detalle + archivos
│   │   ├── reniec/              # Consulta DNI (RENIEC)
│   │   ├── trabajadores/        # Admin y seguridad
│   │   └── usuarios/            # Estudiantes/docentes
│   ├── scripts/
│   │   └── reset-password.js    # CLI para resetear contraseña
│   ├── shared/
│   │   └── middlewares/         # Middlewares compartidos
│   │       ├── auth.middleware.js   # JWT verification (cookie + Bearer)
│   │       ├── cookies.js           # HttpOnly cookie helpers
│   │       ├── rateLimit.middleware.js # Rate limiting
│   │       ├── upload.js            # Multer (memoria)
│   │       └── validate.middleware.js # Zod validation
│   ├── utils/
│   │   ├── email.js             # Nodemailer API
│   │   └── storage.js           # S3-compatible (B2/MinIO)
│   └── index.js                 # Entry point
│
├── frontend/                    # 🎨 Frontend (React Router v8 + SSR)
│   ├── app/
│   │   ├── features/            # Páginas por módulo
│   │   │   ├── auth/            # Login, forgot/reset password
│   │   │   ├── losas/           # Losas (público + admin)
│   │   │   ├── horarios/        # Horarios interactivos
│   │   │   ├── permisos/        # Permisos (admin + user + seguridad)
│   │   │   ├── usuarios/        # Gestión usuarios
│   │   │   ├── trabajadores/    # Gestión trabajadores
│   │   │   ├── disciplinas/     # Disciplinas deportivas
│   │   │   ├── notificaciones/  # Notificaciones
│   │   │   ├── imagenes/        # Imágenes de losas
│   │   │   ├── configuracion/   # Configuración del sistema
│   │   │   └── perfil/          # Perfil por rol
│   │   ├── layouts/             # AdminLayout, UserLayout, SecurityLayout
│   │   ├── lib/                 # Constantes, tipos TS
│   │   ├── routes/              # Configuración de rutas
│   │   ├── services/            # API client (auto-refresh), auth server
│   │   └── shared/              # Componentes reutilizables, roles, format
│   ├── public/
│   ├── Dockerfile
│   ├── react-router.config.ts   # React Router config
│   ├── tsconfig.json
│   ├── vite.config.ts           # Vite 8 + Tailwind 4
│   └── package.json             # React 19, React Router 8, TypeScript 5
│
├── DB/                          # 🗄️ Scripts SQL
│   ├── sistema_losa_schema.sql  # Esquema principal
│   ├── sistema_losa_data.sql    # Datos de ejemplo
│   ├── api_unheval_schema.sql   # Esquema API externa
│   ├── api_unheval_data.sql     # Datos API externa
│   └── credenciales_demo.md     # Credenciales de prueba
│
├── backend_api/                 # 🔌 API proxy UNHEVAL
│   ├── index.js
│   ├── .env
│   └── package.json
│
└── README.md                    # Este archivo
```

## 🔐 Credenciales de prueba

Ver `DB/credenciales_demo.md` para detalles completos.

### Administrador
| Campo | Valor |
|---|---|
| **Email** | `davidchipaco@gmail.com` |
| **Contraseña** | `12345678` |

### Seguridad
| Campo | Valor |
|---|---|
| **Email** | `seguridad@unheval.edu` |
| **Contraseña** | `12345678` |

### Usuario (alumno/docente)
| Campo | Valor |
|---|---|
| **Código** | `20241001` |
| **Contraseña** | `12345678` |

> ℹ️ Los datos de ejemplo se cargan desde `DB/sistema_losa_data.sql`. Los permisos, notificaciones e imágenes vienen limpios (0 registros) para empezar desde cero.

## 📡 Endpoints de la API

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login/usuario` | Login de usuario (código + contraseña) |
| `POST` | `/api/auth/login/trabajador` | Login de admin/seguridad (email + contraseña) |
| `POST` | `/api/auth/refresh` | Refrescar tokens (usa cookies httpOnly) |
| `POST` | `/api/auth/logout` | Cerrar sesión (revoca refresh token) |

### Losas
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/losas` | Listar losas |
| `GET` | `/api/losas/:id` | Obtener losa por ID |
| `POST` | `/api/losas` | Crear losa (admin) |
| `PUT` | `/api/losas/:id` | Actualizar losa (admin) |
| `DELETE` | `/api/losas/:id` | Eliminar losa (admin) |

### Permisos
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/permisos` | Listar permisos |
| `POST` | `/api/permisos` | Crear permiso |
| `PUT` | `/api/permisos/:id/estado` | Cambiar estado (Aceptar/Rechazar) |
| `GET` | `/api/permisos/mis-permisos` | Permisos del usuario autenticado |

### Gestión
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/users` | Listar usuarios |
| `GET` | `/api/trabajadores` | Listar trabajadores |
| `POST` | `/api/trabajadores` | Crear trabajador |
| `GET` | `/api/disciplinas` | Listar disciplinas |
| `POST` | `/api/disciplinas` | Crear disciplina |
| `GET` | `/api/configuracion` | Obtener configuración |
| `GET` | `/api/notificaciones` | Listar notificaciones |
| `GET` | `/api/dias-bloqueados` | Listar días bloqueados |
| `POST` | `/api/dias-bloqueados` | Agregar día bloqueado |
| `GET` | `/api/imagenes` | Listar imágenes de losas |
| `GET` | `/api/reniec` | Consultar DNI (RENIEC) |

### API UNHEVAL (`backend_api/`)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/usuarios` | Listar usuarios UNHEVAL |
| `GET` | `/api/usuario/:codigo` | Obtener usuario por código |
| `GET` | `/api/test` | Health check |

## 👥 Roles del sistema

| Rol | Acceso | Descripción |
|---|---|---|
| **Administrador** | `/dashboard/*` | Gestión completa del sistema |
| **Alumno/Docente** | `/losas`, `/horario`, `/permiso` | Solicitar permisos, ver horarios |
| **Seguridad** | `/seguridad/*` | Control de acceso físico (módulo de vigilancia) |

### Rutas disponibles por rol

**Admin:** inicio, usuarios, permisos, detalle-permisos, trabajadores, losas, disciplinas, imagenes, configuracion, notificacion, perfil

**Usuario:** losas, horario, perfil, permiso, notificaciones

**Seguridad:** modulo (lista de permisos del día), perfil

## 🎨 Funcionalidades principales

- ✅ **Login unificado** — Detección automática de rol por email o código
- ✅ **JWT dual-token** — Access token (15 min) + Refresh token (7d) en cookies httpOnly firmadas
- ✅ **Auto-refresh reactivo** — El frontend renueva tokens automáticamente al expirar
- ✅ **Rate limiting** — Límite de 3 intentos de login, 50 peticiones generales por IP
- ✅ **Reserva de losas** — Selección interactiva de horarios disponibles
- ✅ **Permisos Normal/Especial** — Normal (auto-aprobado) / Especial (con documento adjunto)
- ✅ **Dashboard admin** — Panel con estadísticas en tiempo real
- ✅ **Gestión de usuarios** — CRUD completo
- ✅ **Gestión de losas** — CRUD con imágenes
- ✅ **Notificaciones** — Seguimiento de cambios de estado
- ✅ **Modo oscuro** — Tema claro/oscuro con persistencia
- ✅ **SSR** — Server-Side Rendering con React Router v8
- ✅ **Zod validation** — Validación de entrada en backend con mensajes descriptivos
- ✅ **S3-compatible storage** — Backblaze B2 / MinIO para documentos de permisos
- ✅ **Responsive** — Diseño adaptable a móvil y escritorio

## 📦 Scripts disponibles

### Backend (`backend/`)
```bash
pnpm run dev              # Iniciar servidor con nodemon (puerto 3000)
pnpm run reset-password   # Resetear contraseña de admin/seguridad
# Uso: node src/scripts/reset-password.js <email> <nueva-contraseña>
```

### Frontend (`frontend/`)
```bash
pnpm dev             # Iniciar servidor de desarrollo (puerto 5173)
pnpm build           # Build de producción
pnpm start           # Iniciar servidor de producción
pnpm typecheck       # Verificar tipos TypeScript
```

### API UNHEVAL (`backend_api/`)
```bash
node index.js         # Iniciar proxy API (puerto 3001)
```

## 🐳 Docker (opcional)

El frontend incluye un `Dockerfile` para despliegue en contenedor:

```bash
cd frontend
docker build -t sistema-losa .
docker run -p 3000:3000 sistema-losa
```

## 🧪 Variables de entorno completas

### Backend (`backend/.env.example`)

```env
# ============================================================
# BACKEND-LOSA-JS - Express + JavaScript + MySQL2
# Copia este archivo como .env y completa los valores
# ============================================================

# -------------------- SERVIDOR --------------------
NODE_ENV=development
PORT=3000

# -------------------- BASE DE DATOS (MySQL) --------------------
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=sistema_losa

# -------------------- JWT / TOKENS (minimo 32 caracteres) --------------------
JWT_SECRET=cambia_por_una_clave_segura_de_32_caracteres
JWT_REFRESH_SECRET=cambia_por_otra_clave_secreta_para_refresh_32_car
COOKIE_SECRET=cambia_por_clave_para_firmar_cookies_32_caracteres
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DIAS=7

# -------------------- FRONTEND / CORS --------------------
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# -------------------- S3 / STORAGE (Backblaze B2, MinIO, etc.) --------------------
STORAGE_ENDPOINT=
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_BUCKET=

# -------------------- EMAIL (SMTP) --------------------
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@unheval.edu
MAIL_LOG_FILE=mail.log

# -------------------- RENIEC / API DE CONSULTAS PERU --------------------
RENIEC_API_TOKEN=
RENIEC_API_URL=
```

### Frontend (`frontend/.env.example`)

```env
# ============================================================
# FRONTEND - SISTEMA DE PERMISOS UNHEVAL
# Copia este archivo como .env y completa los valores
# ============================================================

# -------------------- APIs --------------------
API_BASE_URL=http://localhost:3000/api
API_UNHEVAL_URL=http://localhost:3001/api
```

### Backend API UNHEVAL (`backend_api/.env`)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=api_unheval
PORT=3001
```

## 📄 Licencia

Proyecto desarrollado por alumnos de la **Escuela de Ingeniería de Sistemas** de la Universidad Nacional Hermilio Valdizán.