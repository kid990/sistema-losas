# 🏟️ Sistema LOSA — Frontend (React Router v8 + SSR)

Frontend del **Sistema de Gestión de Losas Deportivas UNHEVAL**. Construido con React 19, React Router 8 (SSR), TypeScript 5 y Tailwind CSS 4.

## 🚀 Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo (puerto 5173)
pnpm dev

# Build de producción
pnpm build

# Iniciar servidor de producción
pnpm start

# Verificar tipos TypeScript
pnpm typecheck
```

## 🏗️ Estructura

```
app/
├── features/               # Páginas por módulo
│   ├── auth/               # Login, forgot/reset password
│   ├── configuracion/      # Configuración (admin)
│   ├── disciplinas/        # Disciplinas deportivas (admin)
│   ├── horarios/           # Horarios interactivos (usuario)
│   ├── imagenes/           # Imágenes de losas (admin)
│   ├── losas/              # Losas (público + admin)
│   ├── notificaciones/     # Notificaciones (admin + user)
│   ├── perfil/             # Perfil (admin + seguridad + user)
│   ├── permisos/           # Permisos (admin + user + seguridad)
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
│   └── auth.server.ts      # Sesión, autenticación, roles
├── shared/
│   ├── components/         # Componentes reutilizables
│   │   ├── NavbarSeguridad.tsx
│   │   ├── NavbarUser.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TablaGenerica.tsx
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
- La cookie `_session` de Remix solo guarda datos del usuario (sin tokens)

## 🧭 Rutas

| Ruta | Layout | Descripción |
|---|---|---|
| `/` | — | Página pública principal (losas destacadas) |
| `/login` | — | Inicio de sesión |
| `/logout` | — | Cerrar sesión |
| `/forgot-password` | — | Recuperar contraseña |
| `/reset-password` | — | Restablecer contraseña |
| `/losas` | User | Ver losas disponibles |
| `/horario` | User | Horarios interactivos |
| `/perfil` | User | Perfil de usuario |
| `/permiso` | User | Solicitar permiso |
| `/user/notifs` | User | Notificaciones |
| `/dashboard/*` | Admin | Panel de administración |
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
# URL del backend (opcional, default: http://localhost:3000)
# Se configura en app/lib/constants.ts
```

## 🐳 Docker

```bash
docker build -t sistema-losa-frontend .
docker run -p 3000:3000 sistema-losa-frontend
```
