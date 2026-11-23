# 🏟️ Sistema LOSA — Frontend (React Router v8 + SSR)

Frontend del **Sistema de Gestión de Losas Deportivas UNHEVAL**. Construido con React 19, React Router 8 (SSR), TypeScript 5 y Tailwind CSS 4.

El alcance del producto y el sistema visual se mantienen como fuentes únicas en
[`../PRODUCT.md`](../PRODUCT.md) y [`../DESIGN.md`](../DESIGN.md).

## 🚀 Inicio rápido

```powershell
Copy-Item .env.example .env
pnpm install
pnpm dev
```

Abre `http://localhost:5173`. Para verificar o generar la versión de producción:

```powershell
pnpm typecheck
pnpm build
pnpm start
```

## 🏗️ Estructura

```
app/
├── features/               # Páginas por módulo
│   ├── auth/               # Login, forgot/reset password
│   ├── configuracion/      # Configuración (admin)
│   ├── disciplinas/        # Disciplinas deportivas (admin)
│   ├── horarios/           # Horarios interactivos (usuario)
│   ├── ia/                 # Revisión asistida (admin)
│   ├── imagenes/           # Imágenes de losas (admin)
│   ├── losas/              # Losas (público + admin)
│   ├── notificaciones/     # Notificaciones (admin + user)
│   ├── perfil/             # Perfil (admin + seguridad + user)
│   ├── permisos/           # Permisos (admin + user + seguridad)
│   ├── predicciones/       # Predicción de ocupación RF-04
│   ├── reportes/           # Reportes PDF (admin)
│   ├── trabajadores/       # Trabajadores (admin)
│   └── usuarios/           # Usuarios (admin)
├── layouts/                # Layouts por rol
│   ├── AdminLayout.tsx
│   ├── NavbarAdmin.tsx
│   ├── SecurityLayout.tsx
│   └── UserLayout.tsx
├── lib/
│   ├── constants.ts        # URLs de API
│   └── types.ts            # Interfaces compartidas
├── services/
│   ├── api.server.ts       # API client con auto-refresh reactivo
│   ├── auth.server.ts      # Sesión, autenticación, roles
│   └── jobs.server.ts      # Seguimiento de tareas asíncronas
├── shared/
│   ├── components/         # Componentes reutilizables
│   │   ├── NavbarSeguridad.tsx
│   │   ├── NavbarUser.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SidebarUser.tsx
│   │   ├── TablaGenerica.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ui/             # UI primitives
│   ├── types/roles.ts      # Definición de roles
│   └── utils/format.ts     # Formateo de fechas, etc.
├── routes.ts               # Configuración de rutas
├── root.tsx                # Layout raíz + ErrorBoundary
└── app.css                 # Tailwind + variables CSS
```

## 🔐 Autenticación

- JWT dual-token en **cookies httpOnly firmadas** del backend
- El frontend redirige automáticamente al login si no hay sesión
- **Auto-refresh reactivo**: `api.server.ts` detecta `401 TOKEN_EXPIRED`, renueva tokens vía `/auth/refresh` y reintenta la llamada original
- La cookie `_session` de React Router solo guarda datos del usuario (sin tokens)

## 🧭 Rutas

| Ruta | Layout | Descripción |
|---|---|---|
| `/` | — | Página pública principal (losas destacadas) |
| `/login` | — | Inicio de sesión |
| `/logout` | — | Cerrar sesión |
| `/forgot-password` | — | Recuperar contraseña |
| `/reset-password` | — | Restablecer contraseña |
| `/inicio` | User | Inicio del usuario autenticado |
| `/losas` | User | Ver losas disponibles |
| `/horario` | User | Horarios interactivos |
| `/predicciones` | User | Predicción de ocupación (RF-04) |
| `/perfil` | User | Perfil de usuario |
| `/permiso` | User | Solicitar permiso |
| `/notificaciones` | User | Historial de notificaciones |
| `/dashboard/*` | Admin | Gestión, revisión IA y reportes |
| `/seguridad/*` | Security | Módulo de seguridad |

## 🛠️ Tecnologías

- **React** 19.2
- **React Router** 8.0 (SSR)
- **TypeScript** 5.9 (strict)
- **Tailwind CSS** 4.2
- **Vite** 8.0
- **react-data-table-component** — Tablas interactivas
- **SweetAlert2** — Modales y alertas
- **react-icons** — Iconografía
- **jsonwebtoken** — Verificación de tokens (server-side)

## 🌐 Variables de entorno

```env
# URL pública incorporada por Vite durante la compilación
VITE_API_BASE_URL=http://localhost:3000/api

# URL usada por loaders y actions SSR
API_INTERNAL_BASE_URL=http://localhost:3000/api
```

En Docker, `API_INTERNAL_BASE_URL` apunta al nombre interno `backend-fastapi`; consulta
[`../docker/README.md`](../docker/README.md).

## 🐳 Docker

La opción recomendada es levantar todo el stack mediante Docker Compose. Para construir únicamente el
frontend, ejecuta desde la raíz del repositorio:

```powershell
Copy-Item frontend\.env.docker.example frontend\.env.docker
docker build -f docker/frontend/Dockerfile -t sirlod-frontend:local .
docker run --rm -p 5173:5173 --env-file frontend/.env.docker `
  -e API_INTERNAL_BASE_URL=http://host.docker.internal:3000/api sirlod-frontend:local
```

El backend debe estar disponible en el puerto `3000`. El contenedor publica el frontend en
`http://localhost:5173`.
