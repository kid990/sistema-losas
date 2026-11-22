import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { ROLES } from "~/shared/types/roles";
import { Badge } from "~/shared/components/ui";
import { formatFechaHora } from "~/shared/utils/format";
import {
  FaCalendarCheck,
  FaClock,
  FaFutbol,
  FaFileAlt,
  FaArrowRight,
  FaCheckCircle,
  FaInfoCircle,
  FaEye,
} from "react-icons/fa";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== ROLES.USUARIO.tipo) {
    throw new Response("No autorizado", { status: 403 });
  }

  const [permisosRes, losasRes, configRes] = await Promise.all([
    api.get(`/permisos/usuario/${user.id}`, request).catch(() => ({ data: [] })),
    api.get("/losas", request).catch(() => ({ data: [] })),
    api.get("/configuracion", request).catch(() => null),
  ]);

  const permisos = (((permisosRes as Record<string, unknown>).data || permisosRes || []) as Record<string, unknown>[]);
  const losas = (((losasRes as Record<string, unknown>).data || losasRes || []) as Record<string, unknown>[]);
  const config = configRes as Record<string, unknown> | null;

  return data(
    { user, permisos, losas, config },
    { headers: responseHeadersWithCookies(request) }
  );
}

export default function UserInicio() {
  const { user, permisos, losas, config } = useLoaderData<typeof loader>();
  const permisosList = permisos || [];
  const losasList = losas || [];
  const aprobados = permisosList.filter((p) => p.estado === "Aceptado" || p.estado === "Aprobado").length;
  const pendientes = permisosList.filter((p) => p.estado === "Pendiente").length;
  const disponibles = losasList.filter((l) => !l.estado || l.estado === "Disponible").length;
  const ultimosPermisos = permisosList.slice(0, 4);
  const horaMin = config?.hora_min_apertura ? String(config.hora_min_apertura).substring(0, 5) : "06:00";
  const horaMax = config?.hora_max_apertura ? String(config.hora_max_apertura).substring(0, 5) : "22:00";

  const renderBadgeEstado = (estado: string) => {
    switch (estado) {
      case "Aceptado":
      case "Aprobado":
        return <Badge variant="success" dot>Aprobado</Badge>;
      case "Pendiente":
        return <Badge variant="warning" dot>Pendiente</Badge>;
      case "Rechazado":
        return <Badge variant="danger" dot>Rechazado</Badge>;
      default:
        return <Badge variant="neutral">{estado || "-"}</Badge>;
    }
  };

  return (
    <div className="space-y-7">
      <section className="role-hero" aria-labelledby="user-home-title">
        <div className="role-hero__copy">
          <p className="role-hero__eyebrow">Portal de reservas UNHEVAL</p>
          <h1 id="user-home-title">Hola, {user.nombre}</h1>
          <p className="role-hero__description">
            Consulta la agenda deportiva, elige una franja disponible y conserva aquí tus permisos de ingreso.
          </p>
          <div className="mt-5">
            <Link to="/horario" className="role-hero__action">
              <FaCalendarCheck aria-hidden="true" />
              Consultar horarios
            </Link>
          </div>
        </div>

        <div className="role-hero__stats" aria-label="Resumen de reservas">
          <div className="hero-stat">
            <span className="hero-stat__label">Permisos activos</span>
            <strong className="hero-stat__value">{aprobados}</strong>
            <span className="hero-stat__detail">Reservas autorizadas</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat__label">En revisión</span>
            <strong className="hero-stat__value">{pendientes}</strong>
            <span className="hero-stat__detail">Solicitudes pendientes</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat__label">Atención</span>
            <strong className="hero-stat__value">{horaMin}–{horaMax}</strong>
            <span className="hero-stat__detail">{disponibles} losas disponibles</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.8fr)]">
        <section className="content-panel" aria-labelledby="recent-permissions-title">
          <div className="content-panel__header">
            <div>
              <h2 id="recent-permissions-title">Solicitudes recientes</h2>
              <p>El estado más reciente de tus permisos deportivos.</p>
            </div>
            <Link to="/permiso" className="app-button app-button--secondary">
              Ver todas <FaArrowRight aria-hidden="true" size={12} />
            </Link>
          </div>

          {ultimosPermisos.length === 0 ? (
            <div className="content-panel__body py-12 text-center">
              <FaFileAlt className="mx-auto mb-3 text-3xl text-[var(--text-muted)]" aria-hidden="true" />
              <h3 className="text-xl font-semibold">Todavía no tienes solicitudes</h3>
              <p className="mx-auto mt-2 max-w-[55ch] text-sm text-[var(--text-secondary)]">
                Cuando confirmes una reserva, aparecerá aquí con su estado y permiso de acceso.
              </p>
              <Link to="/horario" className="app-button app-button--primary mt-5">
                Elegir una franja
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {ultimosPermisos.map((permiso) => (
                <li key={String(permiso.id_p)} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="inline-grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-50)] font-display text-lg font-bold text-[var(--color-primary-600)]">
                    #{String(permiso.id_p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">Permiso {String(permiso.tipo || "Normal")}</h3>
                      {renderBadgeEstado(String(permiso.estado || ""))}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Solicitado {formatFechaHora(String(permiso.fecha_creacion || ""))} · Duración {String(permiso.duracion_t || 1)} h
                    </p>
                  </div>
                  <Link to="/permiso" className="app-button app-button--secondary self-start sm:self-auto">
                    <FaEye aria-hidden="true" /> Ver permiso
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-5">
          <section className="content-panel">
            <div className="content-panel__header">
              <div>
                <h2>Cómo reservar</h2>
                <p>Tres pasos para obtener tu permiso.</p>
              </div>
            </div>
            <ol className="content-panel__body space-y-5">
              <li className="flex gap-3">
                <span className="inline-grid size-7 shrink-0 place-items-center rounded-md bg-[var(--color-primary-50)] font-display font-bold text-[var(--color-primary-600)]">1</span>
                <p className="text-sm"><strong className="block text-[var(--text-primary)]">Elige una franja</strong><span className="text-[var(--text-secondary)]">Revisa la losa, fecha y horario disponibles.</span></p>
              </li>
              <li className="flex gap-3">
                <span className="inline-grid size-7 shrink-0 place-items-center rounded-md bg-[var(--color-primary-50)] font-display font-bold text-[var(--color-primary-600)]">2</span>
                <p className="text-sm"><strong className="block text-[var(--text-primary)]">Confirma la solicitud</strong><span className="text-[var(--text-secondary)]">Completa los datos requeridos para el tipo de permiso.</span></p>
              </li>
              <li className="flex gap-3">
                <span className="inline-grid size-7 shrink-0 place-items-center rounded-md bg-[var(--color-primary-50)] font-display font-bold text-[var(--color-primary-600)]">3</span>
                <p className="text-sm"><strong className="block text-[var(--text-primary)]">Presenta tu pase</strong><span className="text-[var(--text-secondary)]">Muestra el permiso autorizado al ingresar.</span></p>
              </li>
            </ol>
          </section>

          <section className="rounded-[14px] bg-[var(--color-unheval-navy)] p-5 text-white">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <FaInfoCircle aria-hidden="true" /> Ingreso al complejo
            </h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">
              Lleva tu carné universitario o documento de identidad junto con el permiso autorizado.
            </p>
            <Link to="/losas" className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-white underline underline-offset-4">
              <FaFutbol aria-hidden="true" /> Ver losas
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

