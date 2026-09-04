import { useState, useMemo } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { Input, Badge } from "~/shared/components/ui";
import { FaBell, FaCheckCircle, FaTimesCircle, FaClock, FaEnvelope, FaExclamationTriangle, FaSearch } from "react-icons/fa";

const typeConfig: Record<string, { icon: typeof FaBell; color: string; bg: string }> = {
  Aceptado: { icon: FaCheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  Rechazado: { icon: FaTimesCircle, color: "text-red-600", bg: "bg-red-50" },
  Pendiente: { icon: FaClock, color: "text-amber-600", bg: "bg-amber-50" },
  Cancelado: { icon: FaExclamationTriangle, color: "text-gray-600", bg: "bg-gray-100" },
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");

  const notificacionesRes = await api.get("/notificaciones", request).catch(() => ({ data: [] }));
  const notificaciones = ((notificacionesRes as Record<string, unknown>).data || []) as Record<string, unknown>[];

  return data({ notificaciones });
}

function formatFecha(fecha: string): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminNotificaciones() {
  const { notificaciones } = useLoaderData<typeof loader>();
  const [filtro, setFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");

  const notificacionesFiltradas = useMemo(() => {
    let lista = [...notificaciones] as Record<string, unknown>[];

    if (filtro !== "todas") {
      lista = lista.filter((n) => (n.tipo as string)?.toLowerCase() === filtro.toLowerCase());
    }

    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      lista = lista.filter((n) =>
        (n.mensaje as string)?.toLowerCase().includes(termino) ||
        String(n.id_p).includes(termino)
      );
    }

    return lista;
  }, [notificaciones, filtro, busqueda]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
            <FaBell className="text-[var(--color-primary-500)]" /> Bandeja de Notificaciones
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Registro de avisos automáticos y comunicaciones enviadas a los usuarios del sistema.
          </p>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="card-theme p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Buscar por mensaje o ID de permiso..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              icon={<FaSearch />}
            />
          </div>

          <div role="tablist" aria-label="Filtros de notificación" className="flex gap-2 flex-wrap">
            {[
              { value: "todas", label: "Todas" },
              { value: "aceptado", label: "Aprobados" },
              { value: "rechazado", label: "Rechazados" },
              { value: "pendiente", label: "Pendientes" },
              { value: "cancelado", label: "Cancelados" },
            ].map((tipo) => (
              <button
                key={tipo.value}
                role="tab"
                aria-selected={filtro === tipo.value}
                onClick={() => setFiltro(tipo.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filtro === tipo.value
                    ? "bg-[var(--color-primary-500)] text-white shadow-sm"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]"
                }`}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de notificaciones */}
      {notificacionesFiltradas.length === 0 ? (
        <div className="card-theme p-12 text-center">
          <FaBell className="text-4xl text-[var(--text-muted)] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">Sin notificaciones</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {busqueda || filtro !== "todas"
              ? "No hay notificaciones que coincidan con los criterios de búsqueda seleccionados."
              : "Aún no se registran notificaciones automáticas en el sistema."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(notificacionesFiltradas as Record<string, unknown>[]).map((notif) => {
            const tipo = (notif.tipo as string) || "Pendiente";
            const config = typeConfig[tipo] || typeConfig.Pendiente;
            const Icon = config.icon;

            return (
              <div
                key={notif.id_n as number}
                className="card-theme p-5 hover:border-[var(--color-primary-500)]/40 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={config.color} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {tipo}
                        </span>
                        <Badge variant={notif.leido ? "neutral" : "primary"}>
                          {notif.leido ? "Leído" : "Sin leer"}
                        </Badge>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 shrink-0 font-medium">
                        <FaEnvelope className="text-[10px]" />
                        {formatFecha(notif.fecha_envio as string)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                      {notif.mensaje as string}
                    </p>
                    {notif.id_p != null && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
                        <span className="text-xs font-semibold text-[var(--color-primary-600)]">
                          Referencia Permiso #{String(notif.id_p)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
