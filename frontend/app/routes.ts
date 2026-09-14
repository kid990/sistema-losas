import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Auth
  route("login", "features/auth/login.tsx"),
  route("logout", "features/auth/logout.tsx"),
  route("forgot-password", "features/auth/forgot-password.tsx"),
  route("reset-password", "features/auth/reset-password.tsx"),
  route("api/reservas", "features/permisos/reservas-resource.ts"),

  // Public home (no auth required)
  index("features/losas/_public._index.tsx"),

  // User routes (require auth - UserLayout has requireAuth)
  layout("layouts/UserLayout.tsx", [
    route("losas", "features/losas/_public.losas.tsx"),
    route("horario", "features/horarios/_public.horario.tsx"),
    route("perfil", "features/perfil/_user.perfil.tsx"),
    route("permiso", "features/permisos/_user.permiso.tsx"),
    route("user/notifs", "features/notificaciones/user-notifs.tsx"),
  ]),

  // Admin dashboard
  layout("layouts/AdminLayout.tsx", [
    route("dashboard", "features/losas/_admin.inicio.tsx", { id: "admin-dashboard-alias" }),
    route("dashboard/inicio", "features/losas/_admin.inicio.tsx", { id: "admin-dashboard-inicio" }),
    route("dashboard/usuarios", "features/usuarios/_admin.usuarios.tsx"),
    route("dashboard/permisos", "features/permisos/_admin.permisos.tsx"),
    route("dashboard/detalle-permisos", "features/permisos/_admin.detalle-permisos.tsx"),
    route("dashboard/trabajadores", "features/trabajadores/_admin.trabajadores.tsx"),
    route("dashboard/losas", "features/losas/_admin.losas.tsx"),
    route("dashboard/disciplinas", "features/disciplinas/_admin.disciplinas.tsx"),
    route("dashboard/imagenes", "features/imagenes/_admin.imagenes.tsx"),
    route("dashboard/configuracion", "features/configuracion/_admin.configuracion.tsx"),
    route("dashboard/notificacion", "features/notificaciones/_admin.notificacion.tsx"),
    route("dashboard/perfil", "features/perfil/_admin.perfil.tsx"),
  ]),

  // Security module
  layout("layouts/SecurityLayout.tsx", [
    route("seguridad", "features/permisos/_seguridad.modulo.tsx", { id: "security-modulo-alias" }),
    route("seguridad/modulo", "features/permisos/_seguridad.modulo.tsx", { id: "security-modulo" }),
    route("seguridad/perfil", "features/perfil/_seguridad.perfil.tsx"),
  ]),
] satisfies RouteConfig;
