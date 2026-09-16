import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import {
  FaKey, FaUserTie, FaThLarge, FaBriefcase,
  FaArrowRight, FaCheckCircle, FaTimesCircle,
  FaClock, FaExclamationTriangle, FaBell, FaCalendarCheck,
} from "react-icons/fa";

type Permiso = Record<string, unknown>;
type Notif   = Record<string, unknown>;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");

  const [
    usuariosRes, trabajadoresRes, losasRes,
    pendientesRes, aprobadosRes, rechazadosRes, notifsRes,
  ] = await Promise.all([
    api.get("/users",                      request).catch(() => []),
    api.get("/trabajadores",               request).catch(() => []),
    api.get("/losas",                      request).catch(() => []),
    api.get("/permisos?estado=Pendiente",  request).catch(() => ({ data: [] })),
    api.get("/permisos?estado=Aprobado",   request).catch(() => ({ data: [] })),
    api.get("/permisos?estado=Rechazado",  request).catch(() => ({ data: [] })),
    api.get("/notificaciones",             request).catch(() => ({ data: [] })),
  ]);

  const count = (r: unknown) => {
    if (Array.isArray(r)) return r.length;
    if (r && typeof r === "object" && "data" in r && Array.isArray((r as { data: unknown[] }).data))
      return (r as { data: unknown[] }).data.length;
    return 0;
  };
  const toArr = (r: unknown): Permiso[] => {
    if (Array.isArray(r)) return r as Permiso[];
    if (r && typeof r === "object" && "data" in r && Array.isArray((r as { data: unknown[] }).data))
      return (r as { data: Permiso[] }).data;
    return [];
  };

  return data({
    totalUsuarios:     count(usuariosRes),
    totalTrabajadores: count(trabajadoresRes),
    totalLosas:        count(losasRes),
    pendientes:        count(pendientesRes),
    aprobados:         count(aprobadosRes),
    rechazados:        count(rechazadosRes),
    ultimosPendientes: toArr(pendientesRes).slice(0, 5),
    ultimasNotifs:     (toArr(notifsRes) as Notif[]).slice(0, 6),
  });
}

function fechaCorta(fecha: string): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const estadoBadge: Record<string, { label: string; cls: string }> = {
  Pendiente: { label: "Pendiente", cls: "bg-amber-100 text-amber-800 border border-amber-300" },
  Aprobado:  { label: "Aprobado",  cls: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  Rechazado: { label: "Rechazado", cls: "bg-red-100 text-red-700 border border-red-300" },
  Cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600 border border-slate-300" },
};

const notifCfg: Record<string, { Icon: typeof FaBell; cls: string; bg: string }> = {
  Aceptado:  { Icon: FaCheckCircle,        cls: "text-emerald-600", bg: "bg-emerald-100" },
  Rechazado: { Icon: FaTimesCircle,        cls: "text-red-500",     bg: "bg-red-100"     },
  Pendiente: { Icon: FaClock,              cls: "text-amber-500",   bg: "bg-amber-100"   },
  Cancelado: { Icon: FaExclamationTriangle,cls: "text-slate-500",   bg: "bg-slate-100"   },
};

export default function AdminInicio() {
  const {
    totalUsuarios     = 0,
    totalTrabajadores = 0,
    totalLosas        = 0,
    pendientes        = 0,
    aprobados         = 0,
    rechazados        = 0,
    ultimosPendientes = [],
    ultimasNotifs     = [],
  } = useLoaderData<typeof loader>();

  const kpis = [
    {
      label: "Pendientes",
      hint:  "Requieren revisión",
      value: pendientes,
      Icon:  FaKey,
      gradient: "from-amber-400 to-orange-500",
      glow:     "shadow-orange-200",
      route:    "/dashboard/permisos",
    },
    {
      label: "Aprobadas",
      hint:  "Reservas confirmadas",
      value: aprobados,
      Icon:  FaCalendarCheck,
      gradient: "from-emerald-400 to-teal-500",
      glow:     "shadow-teal-200",
      route:    "/dashboard/detalle-permisos",
    },
    {
      label: "Rechazadas",
      hint:  "Solicitudes denegadas",
      value: rechazados,
      Icon:  FaTimesCircle,
      gradient: "from-rose-400 to-pink-600",
      glow:     "shadow-pink-200",
      route:    "/dashboard/permisos",
    },
    {
      label: "Losas activas",
      hint:  "Espacios deportivos",
      value: totalLosas,
      Icon:  FaThLarge,
      gradient: "from-blue-500 to-indigo-600",
      glow:     "shadow-indigo-200",
      route:    "/dashboard/losas",
    },
  ];

  return (
    <div className="space-y-8">

      {/* ── Encabezado con banner de alerta si hay pendientes ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Panel de control
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Vista general del sistema · SIRLOD – UNHEVAL
          </p>
        </div>
        {pendientes > 0 && (
          <Link
            to="/dashboard/permisos"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg"
            style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
          >
            <FaKey size={13} aria-hidden="true" />
            {pendientes} solicitud{pendientes !== 1 ? "es" : ""} pendiente{pendientes !== 1 ? "s" : ""}
            <FaArrowRight size={11} aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* ── KPIs con gradientes ── */}
      <section aria-label="Indicadores clave" className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.route}
            className={`group relative overflow-hidden rounded-2xl p-5 text-white flex flex-col justify-between min-h-[140px] bg-gradient-to-br ${k.gradient} shadow-lg ${k.glow} hover:shadow-xl hover:scale-[1.02] transition-all duration-200`}
          >
            {/* Círculo decorativo */}
            <span className="absolute -top-5 -right-5 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <span className="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />

            <div className="flex items-start justify-between relative z-10">
              <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <k.Icon size={18} aria-hidden="true" />
              </span>
              <FaArrowRight
                size={12}
                className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-1"
                aria-hidden="true"
              />
            </div>

            <div className="relative z-10">
              <strong className="block text-4xl font-black leading-none">{k.value}</strong>
              <p className="text-sm font-semibold mt-1 opacity-90">{k.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{k.hint}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* ── Grilla principal ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">

        {/* ── Tabla: últimas solicitudes pendientes ── */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid var(--border-color)", boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}
          aria-label="Solicitudes pendientes recientes"
        >
          {/* Cabecera con gradiente suave */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: "linear-gradient(90deg,#f0f7ff,#e8f0fe)", borderBottom: "1px solid var(--border-color)" }}
          >
            <div>
              <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                🗂️ Solicitudes pendientes
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Últimas {ultimosPendientes.length} sin resolver
              </p>
            </div>
            <Link
              to="/dashboard/permisos"
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--color-primary-500)", color: "#fff" }}
            >
              Ver todas <FaArrowRight size={10} aria-hidden="true" />
            </Link>
          </div>

          {ultimosPendientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <span className="text-5xl">🎉</span>
              <p className="font-bold" style={{ color: "var(--text-primary)" }}>¡Todo al día!</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No hay solicitudes pendientes por revisar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-surface)" }}>
                    {["# ID", "Solicitante", "Tipo", "Fecha", "Estado", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ultimosPendientes.map((p) => {
                    const est = estadoBadge[(p.estado as string)] ?? estadoBadge.Pendiente;
                    return (
                      <tr
                        key={p.id_p as number}
                        className="group transition-colors"
                        style={{ borderBottom: "1px solid var(--border-color)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fbff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                          #{String(p.id_p)}
                        </td>
                        <td className="px-5 py-3.5 font-semibold max-w-[150px] truncate" style={{ color: "var(--text-primary)" }}>
                          {String(p.autor ?? "—")}
                        </td>
                        <td className="px-5 py-3.5" style={{ color: "var(--text-secondary)" }}>
                          {String(p.tipo ?? "—")}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {fechaCorta(p.fecha_creacion as string)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${est.cls}`}>
                            {est.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to="/dashboard/permisos"
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs font-bold transition-opacity"
                            style={{ color: "var(--color-primary-600)" }}
                          >
                            Revisar <FaArrowRight size={9} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Feed: actividad reciente ── */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid var(--border-color)", boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}
          aria-label="Actividad reciente"
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ background: "linear-gradient(90deg,#fdf4ff,#fce7f3)", borderBottom: "1px solid var(--border-color)" }}
          >
            <div>
              <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>🔔 Actividad reciente</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Últimas notificaciones</p>
            </div>
            <Link
              to="/dashboard/notificacion"
              className="text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ background: "#a855f7", color: "#fff" }}
            >
              Ver todo
            </Link>
          </div>

          {ultimasNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <span className="text-4xl">🔕</span>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Sin actividad reciente.</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border-color)" }}>
              {ultimasNotifs.map((n) => {
                const tipo = (n.tipo as string) ?? "Pendiente";
                const cfg  = notifCfg[tipo] ?? notifCfg.Pendiente;
                const Icon = cfg.Icon;
                return (
                  <li
                    key={n.id_n as number}
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf4ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <span className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <Icon size={14} className={cfg.cls} aria-hidden="true" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
                        {String(n.mensaje ?? "Sin mensaje")}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {n.id_p != null && (
                          <span className="text-[10px] font-bold" style={{ color: "var(--color-primary-600)" }}>
                            Permiso #{String(n.id_p)}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {fechaCorta(n.fecha_envio as string)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── Barra de recursos ── */}
      <section aria-label="Resumen de recursos" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Losas deportivas",
            value: totalLosas,
            Icon:  FaThLarge,
            desc:  "Espacios registrados",
            gradient: "from-blue-500 to-cyan-400",
            route: "/dashboard/losas",
          },
          {
            label: "Usuarios",
            value: totalUsuarios,
            Icon:  FaUserTie,
            desc:  "Cuentas en el sistema",
            gradient: "from-violet-500 to-purple-400",
            route: "/dashboard/usuarios",
          },
          {
            label: "Trabajadores",
            value: totalTrabajadores,
            Icon:  FaBriefcase,
            desc:  "Personal administrativo",
            gradient: "from-emerald-500 to-teal-400",
            route: "/dashboard/trabajadores",
          },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.route}
            className={`group relative overflow-hidden flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r ${item.gradient} text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200`}
          >
            {/* Blob decorativo */}
            <span className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
            <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 relative z-10">
              <item.Icon size={20} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-xs font-semibold opacity-80">{item.label}</p>
              <strong className="block text-3xl font-black leading-tight">{item.value}</strong>
              <span className="text-xs opacity-70">{item.desc}</span>
            </div>
            <FaArrowRight
              size={13}
              className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all relative z-10"
              aria-hidden="true"
            />
          </Link>
        ))}
      </section>

    </div>
  );
}
