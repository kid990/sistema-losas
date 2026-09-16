import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { ROLES } from "~/shared/types/roles";
import { Badge } from "~/shared/components/ui";
import { formatFecha, formatFechaHora } from "~/shared/utils/format";
import {
  FaCalendarCheck,
  FaClock,
  FaFutbol,
  FaFileAlt,
  FaArrowRight,
  FaCheckCircle,
  FaInfoCircle,
  FaEye,
  FaRunning,
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
    {
      user,
      permisos,
      losas,
      config,
    },
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
    <div className="space-y-6 max-w-6xl">
      {/* ── Banner de Bienvenida ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1B6EB6] via-[#165b9a] to-cyan-600 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/15">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-cyan-100 border border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Portal de Reservas Estudiantiles
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              ¡Bienvenido, {user.nombre}!
            </h1>
            <p className="text-sm text-cyan-100/90 max-w-xl leading-relaxed">
              Consulta la disponibilidad de las losas deportivas universitarias, reserva bloques de uso y gestiona tus permisos autorizados para ingreso.
            </p>
          </div>
          <Link
            to="/horario"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-[#1B6EB6] font-bold text-sm shadow-lg hover:bg-cyan-50 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <FaCalendarCheck />
            Reservar Ahora
          </Link>
        </div>
      </div>

      {/* ── Tarjetas KPI / Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="card-theme p-5 flex flex-col justify-between hover-lift border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pases Activos</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
              <FaCheckCircle />
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">{aprobados}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Reservas autorizadas</p>
          </div>
        </div>

        <div className="card-theme p-5 flex flex-col justify-between hover-lift border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">En Evaluación</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">
              <FaClock />
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">{pendientes}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Pendientes de revisión</p>
          </div>
        </div>

        <div className="card-theme p-5 flex flex-col justify-between hover-lift border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Losas Hoy</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
              <FaFutbol />
            </span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-bold text-slate-800">{disponibles}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Campos disponibles</p>
          </div>
        </div>

        <div className="card-theme p-5 flex flex-col justify-between hover-lift border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Horario de Atención</span>
            <span className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-sm font-bold">
              <FaRunning />
            </span>
          </div>
          <div>
            <span className="text-base sm:text-lg font-bold text-slate-800">{horaMin} - {horaMax}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Lunes a Domingo</p>
          </div>
        </div>
      </div>

      {/* ── Accesos Rápidos y Actividad ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mis Permisos Recientes (2 columnas) */}
        <div className="lg:col-span-2 card-theme p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100"></span>
              <h2 className="text-base font-bold text-slate-800">Mis Solicitudes Recientes</h2>
            </div>
            <Link
              to="/permiso"
              className="text-xs font-bold text-[#1B6EB6] hover:text-[#144a7e] flex items-center gap-1 group"
            >
              Ver todas <FaArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {ultimosPermisos.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <FaFileAlt className="text-4xl mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No tienes solicitudes registradas</p>
              <p className="text-xs text-slate-400 mt-1">Realiza tu primera reserva deportiva desde la sección de horarios.</p>
              <Link
                to="/horario"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-blue-50 text-[#1B6EB6] text-xs font-bold hover:bg-blue-100 transition-colors"
              >
                Solicitar reserva
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {ultimosPermisos.map((p) => (
                <div
                  key={p.id_p as number}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 hover:bg-blue-50/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-mono font-bold text-xs text-slate-700 shadow-xs">
                      #{String(p.id_p)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Tipo: {String(p.tipo || "Normal")}</span>
                        {renderBadgeEstado(p.estado as string)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Solicitado: {formatFechaHora(p.fecha_creacion as string)} • Duración: {String(p.duracion_t || 1)}h
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/permiso"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#1B6EB6] hover:border-blue-300 text-xs font-semibold shadow-xs transition-all self-end sm:self-center"
                  >
                    <FaEye size={11} /> Ver Pase
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral: Pasos y Normas Rápidas (1 columna) */}
        <div className="space-y-6">
          <div className="card-theme p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <FaInfoCircle className="text-[#1B6EB6]" />
              <h2 className="text-sm font-bold text-slate-800">Pasos para Reservar</h2>
            </div>
            <ol className="space-y-3 text-xs text-slate-600">
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1B6EB6] flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                <span><strong>Elige el horario:</strong> Selecciona la losa y bloque disponible en la cuadrícula.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1B6EB6] flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                <span><strong>Confirma tu solicitud:</strong> Para uso regular se aprueba de inmediato.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-[#1B6EB6] flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                <span><strong>Presenta tu pase:</strong> Muestra tu constancia en garita para ingresar al campo.</span>
              </li>
            </ol>
          </div>

          <div className="card-theme p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3 border-none shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FaFutbol className="text-cyan-400" /> Complejo Deportivo UNHEVAL
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Recuerda portar tu carnet universitario o documento de identidad al momento de ingresar a las instalaciones deportivas.
            </p>
            <Link
              to="/losas"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200 pt-1"
            >
              Explorar catálogo de losas <FaArrowRight size={10} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
