import { useState, useMemo } from "react";
import { useLoaderData, useFetcher, NavLink } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import {
  FaBell,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaExclamationCircle,
  FaCheckDouble,
  FaSearch,
  FaInbox,
  FaArrowRight,
  FaCalendarAlt,
  FaShieldAlt,
  FaCheck,
} from "react-icons/fa";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { ROLES } from "~/shared/types/roles";

export interface UserNotificacion {
  id_n: number;
  mensaje: string;
  tipo: "Aceptado" | "Rechazado" | "Pendiente" | "Cancelado" | string;
  id_p: number | null;
  fecha_envio: string;
  leido: boolean | number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== ROLES.USUARIO.tipo) {
    throw new Response("No autorizado", { status: 403 });
  }

  const notifsRes = await api
    .get(`/notificaciones/usuario/${user.id}`, request)
    .catch(() => ({ data: [] }));

  const notificaciones = ((notifsRes as Record<string, unknown>).data || []) as UserNotificacion[];

  return data(
    { notificaciones, user },
    { headers: responseHeadersWithCookies(request) }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== ROLES.USUARIO.tipo) {
    return data({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "marcar-leida") {
      const id_n = formData.get("id_n") as string;
      if (!id_n) return data({ ok: false, error: "ID requerido" }, { status: 400 });
      await api.patch(`/notificaciones/${id_n}/leido`, request);
      return data({ ok: true, intent, id_n }, { headers: responseHeadersWithCookies(request) });
    }

    if (intent === "marcar-todas-leidas") {
      await api.patch(`/notificaciones/usuario/${user.id}/leidas`, request);
      return data({ ok: true, intent }, { headers: responseHeadersWithCookies(request) });
    }
  } catch {
    return data(
      { ok: false, error: "Error al actualizar la notificación" },
      { status: 500, headers: responseHeadersWithCookies(request) }
    );
  }

  return data({ ok: false, error: "Acción no válida" }, { status: 400 });
}

function formatFecha(fechaStr?: string): { relativo: string; completo: string } {
  if (!fechaStr) return { relativo: "Reciente", completo: "" };
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return { relativo: fechaStr, completo: fechaStr };

  const ahora = new Date();
  const diffMs = ahora.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relativo = "";
  if (diffMins < 1) relativo = "Hace un momento";
  else if (diffMins < 60) relativo = `Hace ${diffMins} min`;
  else if (diffHoras < 24 && ahora.getDate() === d.getDate())
    relativo = `Hoy a las ${d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
  else if (diffDias === 1)
    relativo = `Ayer a las ${d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
  else if (diffDias < 7) relativo = `Hace ${diffDias} días`;
  else
    relativo = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

  const completo = d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return { relativo, completo };
}

const tipoConfig: Record<
  string,
  {
    icon: typeof FaBell;
    badgeLabel: string;
    badgeClass: string;
    cardBorder: string;
    bgPill: string;
  }
> = {
  Aceptado: {
    icon: FaCheckCircle,
    badgeLabel: "Aprobada",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cardBorder: "border-l-emerald-500",
    bgPill: "bg-emerald-50 text-emerald-700",
  },
  Rechazado: {
    icon: FaTimesCircle,
    badgeLabel: "Rechazada",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    cardBorder: "border-l-rose-500",
    bgPill: "bg-rose-50 text-rose-700",
  },
  Pendiente: {
    icon: FaClock,
    badgeLabel: "En Revisión",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    cardBorder: "border-l-amber-500",
    bgPill: "bg-amber-50 text-amber-700",
  },
  Cancelado: {
    icon: FaExclamationCircle,
    badgeLabel: "Cancelada",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    cardBorder: "border-l-slate-400",
    bgPill: "bg-slate-50 text-slate-700",
  },
};

export default function UserNotificacionesPage() {
  const { notificaciones } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [filtro, setFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");

  // Conteo de no leídas
  const totalNoLeidas = useMemo(
    () => notificaciones.filter((n) => !n.leido).length,
    [notificaciones]
  );

  // Filtrado reactivo
  const notificacionesFiltradas = useMemo(() => {
    let res = [...notificaciones];

    if (filtro === "no-leidas") {
      res = res.filter((n) => !n.leido);
    } else if (filtro !== "todas") {
      res = res.filter((n) => n.tipo?.toLowerCase() === filtro.toLowerCase());
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      res = res.filter(
        (n) =>
          n.mensaje?.toLowerCase().includes(q) ||
          (n.id_p && String(n.id_p).includes(q))
      );
    }

    return res;
  }, [notificaciones, filtro, busqueda]);

  const handleMarcarLeida = (id_n: number) => {
    const fd = new FormData();
    fd.append("intent", "marcar-leida");
    fd.append("id_n", String(id_n));
    fetcher.submit(fd, { method: "post" });
  };

  const handleMarcarTodasLeidas = () => {
    const fd = new FormData();
    fd.append("intent", "marcar-todas-leidas");
    fetcher.submit(fd, { method: "post" });
  };

  const isSubmitting = fetcher.state !== "idle";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 rounded-full bg-blue-50/70 pointer-events-none blur-xl" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 text-2xl font-bold shrink-0">
              <FaBell />
            </span>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Bandeja de Notificaciones
                </h1>
                {totalNoLeidas > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500 text-white shadow-xs animate-pulse">
                    {totalNoLeidas} sin leer
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <FaCheck size={10} /> Todo al día
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Avisos automáticos sobre tus solicitudes de losas, revisiones con IA y confirmaciones institucionales.
              </p>
            </div>
          </div>

          {totalNoLeidas > 0 && (
            <button
              type="button"
              onClick={handleMarcarTodasLeidas}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold border border-slate-200 transition-all shadow-2xs hover:border-slate-300 disabled:opacity-50 cursor-pointer"
            >
              <FaCheckDouble className="text-blue-600 text-xs" />
              <span>Marcar todas como leídas</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BARRA DE CONTROLES: FILTROS + BUSCADOR ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Pestañas de filtro */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: "todas", label: "Todas", count: notificaciones.length },
            { id: "no-leidas", label: "Sin leer", count: totalNoLeidas },
            {
              id: "aceptado",
              label: "Aprobadas",
              count: notificaciones.filter((n) => n.tipo === "Aceptado").length,
            },
            {
              id: "rechazado",
              label: "Rechazadas",
              count: notificaciones.filter((n) => n.tipo === "Rechazado").length,
            },
            {
              id: "pendiente",
              label: "Pendientes",
              count: notificaciones.filter((n) => n.tipo === "Pendiente").length,
            },
          ].map((tab) => {
            const activo = filtro === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltro(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activo
                    ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                    activo
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador */}
        <div className="relative min-w-[240px]">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Buscar por mensaje o ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── LISTA DE NOTIFICACIONES ── */}
      {notificacionesFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl">
            <FaInbox />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              No hay notificaciones para mostrar
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {busqueda
                ? `No se encontraron coincidencias para "${busqueda}". Prueba con otro término.`
                : filtro === "no-leidas"
                ? "¡Excelente! Has leído todos tus avisos recientes."
                : "Aún no tienes notificaciones en esta categoría. Cuando reserves una losa o la IA evalúe tu documento, aparecerán aquí."}
            </p>
          </div>
          <NavLink
            to="/permiso"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors mt-2"
          >
            <span>Consultar mis solicitudes de permisos</span>
            <FaArrowRight size={10} />
          </NavLink>
        </div>
      ) : (
        <div className="space-y-3">
          {notificacionesFiltradas.map((item) => {
            const config = tipoConfig[item.tipo] || tipoConfig.Pendiente;
            const Icon = config.icon;
            const leido = Boolean(item.leido);
            const { relativo, completo } = formatFecha(item.fecha_envio);

            return (
              <div
                key={item.id_n}
                className={`group bg-white rounded-2xl border transition-all duration-200 hover:shadow-md relative overflow-hidden ${
                  !leido
                    ? `border-slate-200 bg-gradient-to-r from-blue-50/40 via-white to-white shadow-2xs border-l-4 ${config.cardBorder}`
                    : "border-slate-200/80 hover:border-slate-300 opacity-90 hover:opacity-100 border-l-4 border-l-transparent"
                }`}
              >
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start justify-between gap-4">
                  {/* Icono + Contenido */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <span
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5 border ${config.badgeClass}`}
                    >
                      <Icon />
                    </span>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeClass}`}
                        >
                          {config.badgeLabel}
                        </span>

                        {item.id_p && (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Solicitud #{item.id_p}
                          </span>
                        )}

                        {!leido && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            Nueva
                          </span>
                        )}

                        <span
                          className="text-xs text-slate-400 ml-auto flex items-center gap-1"
                          title={completo}
                        >
                          <FaCalendarAlt size={10} />
                          {relativo}
                        </span>
                      </div>

                      {/* Mensaje descriptivo */}
                      <p className="text-sm font-medium text-slate-800 leading-relaxed pr-2">
                        {item.mensaje}
                      </p>

                      {/* Enlace o acción contextual */}
                      <div className="flex items-center gap-4 pt-1 text-xs">
                        {item.id_p && (
                          <NavLink
                            to="/permiso"
                            className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          >
                            <span>Ver detalle en Mis Permisos</span>
                            <FaArrowRight size={10} />
                          </NavLink>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botón de marcar individualmente como leída si no lo está */}
                  {!leido && (
                    <div className="sm:self-center shrink-0 w-full sm:w-auto flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleMarcarLeida(item.id_n)}
                        disabled={isSubmitting}
                        title="Marcar como leída"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100/70 hover:bg-blue-50 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <FaCheck size={10} />
                        <span>Leída</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
