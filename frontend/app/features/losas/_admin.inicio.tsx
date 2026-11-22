import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import {
  FaKey,
  FaUserTie,
  FaThLarge,
  FaBriefcase,
  FaArrowRight,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaExclamationTriangle,
  FaBell,
  FaCalendarCheck,
} from "react-icons/fa";

type Permiso = Record<string, unknown>;
type Notif = Record<string, unknown>;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");

  const [usuariosRes, trabajadoresRes, losasRes, permisosRes, notifsRes] = await Promise.all([
    api.get("/users", request).catch(() => []),
    api.get("/trabajadores", request).catch(() => []),
    api.get("/losas", request).catch(() => []),
    api.get("/permisos", request).catch(() => ({ data: [] })),
    api.get("/notificaciones", request).catch(() => ({ data: [] })),
  ]);

  const count = (response: unknown) => {
    if (Array.isArray(response)) return response.length;
    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      Array.isArray((response as { data: unknown[] }).data)
    ) {
      return (response as { data: unknown[] }).data.length;
    }
    return 0;
  };

  const toArray = (response: unknown): Permiso[] => {
    if (Array.isArray(response)) return response as Permiso[];
    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      Array.isArray((response as { data: unknown[] }).data)
    ) {
      return (response as { data: Permiso[] }).data;
    }
    return [];
  };

  const todosPermisos = toArray(permisosRes);
  const pendientesList = todosPermisos.filter((permiso) => permiso.estado === "Pendiente");
  const aprobadosCount = todosPermisos.filter(
    (permiso) => permiso.estado === "Aceptado" || permiso.estado === "Aprobado"
  ).length;
  const rechazadosCount = todosPermisos.filter((permiso) => permiso.estado === "Rechazado").length;

  return data({
    totalUsuarios: count(usuariosRes),
    totalTrabajadores: count(trabajadoresRes),
    totalLosas: count(losasRes),
    pendientes: pendientesList.length,
    aprobados: aprobadosCount,
    rechazados: rechazadosCount,
    ultimosPendientes: pendientesList.slice(0, 5),
    ultimasNotifs: (toArray(notifsRes) as Notif[]).slice(0, 6),
  });
}

function fechaCorta(fecha: string): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const notificationConfig: Record<string, { Icon: typeof FaBell; className: string }> = {
  Aceptado: { Icon: FaCheckCircle, className: "text-[var(--color-status-success)]" },
  Aprobado: { Icon: FaCheckCircle, className: "text-[var(--color-status-success)]" },
  Rechazado: { Icon: FaTimesCircle, className: "text-[var(--color-status-danger)]" },
  Pendiente: { Icon: FaClock, className: "text-[var(--color-status-warning)]" },
  Cancelado: { Icon: FaExclamationTriangle, className: "text-[var(--text-muted)]" },
};

export default function AdminInicio() {
  const {
    totalUsuarios = 0,
    totalTrabajadores = 0,
    totalLosas = 0,
    pendientes = 0,
    aprobados = 0,
    rechazados = 0,
    ultimosPendientes = [],
    ultimasNotifs = [],
  } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-7">
      <section className="role-hero" aria-labelledby="admin-home-title">
        <div className="role-hero__copy">
          <p className="role-hero__eyebrow">Gestión deportiva UNHEVAL</p>
          <h1 id="admin-home-title">Panel de Bienestar</h1>
          <p className="role-hero__description">
            Revisa solicitudes, controla la infraestructura deportiva y mantén la agenda de losas lista para la comunidad universitaria.
          </p>
          {pendientes > 0 && (
            <div className="mt-5">
              <Link to="/dashboard/permisos" className="role-hero__action">
                <FaKey aria-hidden="true" />
                Revisar {pendientes} pendiente{pendientes === 1 ? "" : "s"}
              </Link>
            </div>
          )}
        </div>

        <div className="role-hero__stats" aria-label="Estado de la operación">
          <div className="hero-stat">
            <span className="hero-stat__label">Pendientes</span>
            <strong className="hero-stat__value">{pendientes}</strong>
            <span className="hero-stat__detail">Requieren revisión</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat__label">Aprobadas</span>
            <strong className="hero-stat__value">{aprobados}</strong>
            <span className="hero-stat__detail">Reservas confirmadas</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat__label">Losas</span>
            <strong className="hero-stat__value">{totalLosas}</strong>
            <span className="hero-stat__detail">Espacios registrados</span>
          </div>
        </div>
      </section>

      <section className="metric-strip" aria-label="Resumen del sistema">
        <Link to="/dashboard/usuarios" className="metric-item">
          <span className="metric-item__top"><FaUserTie aria-hidden="true" /> Usuarios</span>
          <strong className="metric-item__value">{totalUsuarios}</strong>
          <span className="metric-item__detail">Cuentas registradas</span>
        </Link>
        <Link to="/dashboard/trabajadores" className="metric-item">
          <span className="metric-item__top"><FaBriefcase aria-hidden="true" /> Trabajadores</span>
          <strong className="metric-item__value">{totalTrabajadores}</strong>
          <span className="metric-item__detail">Personal del sistema</span>
        </Link>
        <Link to="/dashboard/permisos" className="metric-item">
          <span className="metric-item__top"><FaTimesCircle aria-hidden="true" /> Rechazadas</span>
          <strong className="metric-item__value">{rechazados}</strong>
          <span className="metric-item__detail">Solicitudes denegadas</span>
        </Link>
        <Link to="/dashboard/notificacion" className="metric-item">
          <span className="metric-item__top"><FaBell aria-hidden="true" /> Actividad</span>
          <strong className="metric-item__value">{ultimasNotifs.length}</strong>
          <span className="metric-item__detail">Notificaciones recientes</span>
        </Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
        <section className="content-panel" aria-labelledby="pending-title">
          <div className="content-panel__header">
            <div>
              <h2 id="pending-title">Solicitudes pendientes</h2>
              <p>Las últimas solicitudes que aún necesitan una decisión.</p>
            </div>
            <Link to="/dashboard/permisos" className="app-button app-button--secondary">
              Ver todas <FaArrowRight aria-hidden="true" size={12} />
            </Link>
          </div>

          {ultimosPendientes.length === 0 ? (
            <div className="content-panel__body py-12 text-center">
              <FaCheckCircle className="mx-auto mb-3 text-4xl text-[var(--color-status-success)]" aria-hidden="true" />
              <h3 className="text-xl font-semibold">Todo está revisado</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">No hay solicitudes pendientes en este momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                    {["Permiso", "Solicitante", "Tipo", "Fecha", "Estado", ""].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-left text-xs font-bold text-[var(--text-muted)]">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {ultimosPendientes.map((permiso) => (
                    <tr key={String(permiso.id_p)} className="hover:bg-[var(--bg-surface)]">
                      <td className="px-5 py-4 font-display text-lg font-semibold">#{String(permiso.id_p)}</td>
                      <td className="max-w-[180px] truncate px-5 py-4 font-semibold">{String(permiso.autor ?? "—")}</td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">{String(permiso.tipo ?? "—")}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-[var(--text-secondary)]">{fechaCorta(String(permiso.fecha_creacion ?? ""))}</td>
                      <td className="px-5 py-4">
                        <span className="badge-warning">Pendiente</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link to="/dashboard/permisos" className="font-bold text-[var(--color-primary-600)] underline-offset-4 hover:underline">
                          Revisar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="content-panel" aria-labelledby="activity-title">
          <div className="content-panel__header">
            <div>
              <h2 id="activity-title">Actividad reciente</h2>
              <p>Últimos cambios registrados.</p>
            </div>
          </div>
          {ultimasNotifs.length === 0 ? (
            <div className="content-panel__body text-sm text-[var(--text-secondary)]">No hay actividad reciente.</div>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {ultimasNotifs.map((notification) => {
                const status = String(notification.tipo ?? notification.estado ?? "Pendiente");
                const config = notificationConfig[status] ?? notificationConfig.Pendiente;
                const Icon = config.Icon;
                const notificationKey = String(
                  notification.id_n ??
                  notification.id ??
                  `${status}-${notification.mensaje ?? "actualizacion"}-${notification.fecha_envio ?? notification.created_at ?? "sin-fecha"}`
                );
                return (
                  <li key={notificationKey} className="flex gap-3 px-5 py-4">
                    <Icon className={`mt-0.5 shrink-0 ${config.className}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{String(notification.mensaje ?? "Actualización del sistema")}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {fechaCorta(String(notification.fecha_envio ?? notification.created_at ?? ""))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-[var(--border-color)] p-4">
            <Link to="/dashboard/notificacion" className="app-button app-button--secondary w-full">
              Abrir notificaciones <FaArrowRight aria-hidden="true" size={12} />
            </Link>
          </div>
        </section>
      </div>

      <section className="section-heading">
        <div>
          <h2>Administración del sistema</h2>
          <p>Accesos directos a los espacios y reservas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard/losas" className="app-button app-button--secondary"><FaThLarge aria-hidden="true" /> Losas</Link>
          <Link to="/dashboard/detalle-permisos" className="app-button app-button--primary"><FaCalendarCheck aria-hidden="true" /> Reservas</Link>
        </div>
      </section>
    </div>
  );
}

