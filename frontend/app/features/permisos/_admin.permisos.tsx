import { useState, useMemo } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { FaEye, FaFilePdf, FaCheck, FaTimes, FaUndo, FaSearch, FaFilter } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { API_BASE_URL } from "~/lib/constants";
import {
  normalizeReservationApiError,
  reservationErrorMessage,
  reservationErrorTitle,
  type ReservationErrorPayload,
} from "~/lib/reservation-errors";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Modal, Select, Badge, Spinner } from "~/shared/components/ui";
import { formatFecha, formatFechaHora } from "~/shared/utils/format";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const url = new URL(request.url);
  const estado = url.searchParams.get("estado") || "Pendiente";
  const permisos = await api.get(`/permisos?estado=${estado}`, request);
  return data({ estadoActual: estado, permisos: (permisos as Record<string, unknown>).data || permisos || [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "detalles") {
    const id_p = fd.get("id_p") as string;
    try {
      const res = await api.get(`/permisos/detalles/${id_p}`, request);
      return data({ ok: true, data: (res as Record<string, unknown>).data || [] });
    } catch (err) {
      console.error("Error al cargar detalles:", err);
      return data({ ok: false, error: "Error al cargar detalles" }, { status: 500 });
    }
  }

  if (intent === "cambiarEstado") {
    try {
      const res = await api.put(`/permisos/${fd.get("id_p")}/estado`, request, {
        estado: fd.get("estado"),
      });
      return data({ ok: true, message: (res as Record<string, unknown>).message || "Estado actualizado" });
    } catch (error) {
      if (error instanceof Response) throw error;
      const normalized = normalizeReservationApiError(error, "No se pudo actualizar el permiso");
      return data(
        {
          ok: false,
          error: normalized.payload.message,
          code: normalized.payload.code,
          details: normalized.payload.details,
          conflicts: normalized.payload.conflicts,
        },
        { status: normalized.status },
      );
    }
  }

  if (intent === "documento") {
    const res = await api.get(`/permisos/${fd.get("id_p")}/documento`, request);
    return data({ ok: true, data: res });
  }

  return data({ ok: false });
}

export default function AdminPermisos() {
  const { estadoActual, permisos } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();
  const [busqueda, setBusqueda] = useState("");
  const [detallesModal, setDetallesModal] = useState<{
    open: boolean;
    permiso: Record<string, unknown> | null;
    detalles: Record<string, unknown>[];
    loading: boolean;
  }>({
    open: false,
    permiso: null,
    detalles: [],
    loading: false,
  });

  const list = (permisos as Record<string, unknown>[]) || [];

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return list;
    const q = busqueda.toLowerCase();
    return list.filter((p) => {
      const texto = `${p.id_p} ${p.autor} ${p.tipo} ${p.estado} ${p.duracion_t} ${formatFechaHora(p.fecha_creacion as string)}`.toLowerCase();
      return texto.includes(q);
    });
  }, [list, busqueda]);

  const verDetalles = async (permiso: Record<string, unknown>) => {
    setDetallesModal({ open: true, permiso, detalles: [], loading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/permisos/detalles/${permiso.id_p}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudieron obtener los detalles");
      const result = await res.json();
      setDetallesModal((s) => ({ ...s, detalles: result.data || [], loading: false }));
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron obtener los detalles de los bloques horarios.",
      });
      setDetallesModal((s) => ({ ...s, loading: false }));
    }
  };

  const cambiarEstado = async (idP: number, nuevoEstado: string) => {
    const confirm = await Swal.fire({
      title: `¿Marcar permiso como ${nuevoEstado}?`,
      text: `La solicitud #${idP} pasará al estado ${nuevoEstado}.`,
      icon: nuevoEstado === "Aceptado" ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: nuevoEstado === "Aceptado" ? "#10b981" : nuevoEstado === "Rechazado" ? "#EC5252" : "#6b7280",
      confirmButtonText: `Sí, ${nuevoEstado.toLowerCase()}`,
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: "Actualizando estado...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const fd = new FormData();
      fd.append("intent", "cambiarEstado");
      fd.append("id_p", String(idP));
      fd.append("estado", nuevoEstado);
      const response = await fetch("", { method: "post", body: fd });
      const result = (await response.json().catch(() => ({}))) as ReservationErrorPayload & {
        ok?: boolean;
      };
      if (!response.ok || result.ok === false) {
        const error = new Error(reservationErrorMessage(result)) as Error & { code?: string };
        error.code = result.code;
        throw error;
      }
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `El permiso #${idP} ahora está ${nuevoEstado}.`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      const reservationError = error as Error & { code?: string };
      Swal.fire({
        icon: "error",
        title: reservationErrorTitle(reservationError.code),
        text: reservationError.message || "No se pudo actualizar el estado de la solicitud.",
        confirmButtonText: "Entendido",
      });
    }
  };

  const verDocumento = async (idP: number) => {
    try {
      const fd = new FormData();
      fd.append("intent", "documento");
      fd.append("id_p", String(idP));
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      const doc = result.data;
      if (doc?.success && doc?.url_drive) {
        window.open(doc.url_drive, "_blank");
      } else {
        Swal.fire({
          icon: "info",
          title: "Sin documento",
          text: "Esta solicitud no tiene archivo de justificación adjunto.",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo obtener el documento digital.",
      });
    }
  };

  const renderBadgeEstado = (estado: string) => {
    switch (estado) {
      case "Aceptado":
      case "Aprobado":
        return <Badge variant="success" dot>Aprobado</Badge>;
      case "Pendiente":
        return <Badge variant="warning" dot>Pendiente</Badge>;
      case "Rechazado":
        return <Badge variant="danger" dot>Rechazado</Badge>;
      case "Cancelado":
        return <Badge variant="neutral">Cancelado</Badge>;
      default:
        return <Badge variant="neutral">{estado || "-"}</Badge>;
    }
  };

  const columnas = [
    { name: "ID", selector: (r: Record<string, unknown>) => `#${r.id_p}`, width: "80px", sortable: true },
    { name: "Solicitante", selector: (r: Record<string, unknown>) => (r.autor as string) || "-", sortable: true },
    {
      name: "Tipo",
      cell: (r: Record<string, unknown>) => (
        <Badge variant={r.tipo === "Especial" ? "info" : "primary"}>
          {String(r.tipo || "Normal")}
        </Badge>
      ),
      sortable: true,
    },
    { name: "Duración", selector: (r: Record<string, unknown>) => `${r.duracion_t}h`, width: "95px", sortable: true },
    { name: "Estado", cell: (r: Record<string, unknown>) => renderBadgeEstado(r.estado as string), sortable: true },
    { name: "Solicitado", selector: (r: Record<string, unknown>) => formatFechaHora(r.fecha_creacion as string), sortable: true },
    {
      name: "Adjunto",
      cell: (r: Record<string, unknown>) =>
        r.tipo === "Especial" && r.tiene_documento ? (
          <button
            type="button"
            onClick={() => verDocumento(r.id_p as number)}
            aria-label={`Ver documento PDF del permiso #${r.id_p}`}
            title="Ver Documento PDF"
            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <FaFilePdf aria-hidden="true" size={18} />
          </button>
        ) : (
          <span className="text-[var(--text-muted)] text-xs font-mono">Regular</span>
        ),
    },
  ];

  const columnasDetalles = [
    { name: "ID Losa", selector: (r: Record<string, unknown>) => `Campo #${r.id_l}` },
    { name: "Ubicación", selector: (r: Record<string, unknown>) => (r.ubicacion as string) || "Campus UNHEVAL" },
    { name: "Disciplina", selector: (r: Record<string, unknown>) => (r.disciplina as string) || "N/A" },
    { name: "Fecha de Uso", selector: (r: Record<string, unknown>) => formatFecha(r.fecha as string) },
    { name: "Hora Inicio", selector: (r: Record<string, unknown>) => (r.hora_inicio as string) || "-" },
    { name: "Hora Fin", selector: (r: Record<string, unknown>) => (r.hora_fin as string) || "-" },
    { name: "Duración", selector: (r: Record<string, unknown>) => `${r.duracion}h` },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-orange-200 text-xl font-bold">
            📋
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Gestión de Solicitudes y Permisos
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Evalúa, autoriza o rechaza solicitudes de uso de las losas deportivas
            </p>
          </div>
        </div>
      </div>

      <div className="card-theme p-6">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6">
          {/* Pills de estado vivos */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {[
              { id: "Pendiente", label: "Pendientes", color: "text-amber-700", activeBg: "bg-white text-amber-600 shadow-sm font-bold" },
              { id: "Aceptado", label: "Aprobados", color: "text-emerald-700", activeBg: "bg-white text-emerald-600 shadow-sm font-bold" },
              { id: "Rechazado", label: "Rechazados", color: "text-rose-700", activeBg: "bg-white text-rose-600 shadow-sm font-bold" },
              { id: "Cancelado", label: "Cancelados", color: "text-slate-600", activeBg: "bg-white text-slate-700 shadow-sm font-bold" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(`/dashboard/permisos?estado=${tab.id}`)}
                className={`px-3.5 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                  estadoActual === tab.id
                    ? tab.activeBg
                    : "text-slate-600 hover:text-slate-900 font-medium"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-w-xs w-full">
            <Input
              aria-label="Buscar permisos"
              placeholder="Buscar por ID, usuario o tipo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              icon={<FaSearch />}
            />
          </div>
        </div>

        <TablaGenerica
          columnas={columnas}
          datos={filtrados}
          titulo={`Listado de Solicitudes (${estadoActual})`}
          mensajeVacio={`No hay solicitudes con estado "${estadoActual}"`}
          submensajeVacio={busqueda ? "Prueba cambiando los términos de búsqueda" : "Selecciona otro estado para ver más solicitudes."}
          acciones={(row: Record<string, unknown>) => (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => verDetalles(row)}
                aria-label={`Ver detalles del permiso #${row.id_p}`}
                title="Ver desglose de reserva"
                className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200/80 rounded-xl transition-all hover:scale-105"
              >
                <FaEye size={14} />
              </button>

              {row.estado === "Pendiente" && (
                <>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(row.id_p as number, "Aceptado")}
                    aria-label={`Aprobar permiso #${row.id_p}`}
                    title="Aprobar solicitud"
                    className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200/80 rounded-xl transition-all hover:scale-105"
                  >
                    <FaCheck size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(row.id_p as number, "Rechazado")}
                    aria-label={`Rechazar permiso #${row.id_p}`}
                    title="Rechazar solicitud"
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200/80 rounded-xl transition-all hover:scale-105"
                  >
                    <FaTimes size={13} />
                  </button>
                </>
              )}

              {row.estado === "Aceptado" && (
                <button
                  type="button"
                  onClick={() => cambiarEstado(row.id_p as number, "Cancelado")}
                  aria-label={`Cancelar permiso #${row.id_p}`}
                  title="Cancelar autorización"
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 ring-1 ring-slate-200 rounded-xl transition-all"
                >
                  <FaTimes aria-hidden="true" size={13} />
                </button>
              )}

              {(row.estado === "Rechazado" || row.estado === "Cancelado") && (
                <button
                  type="button"
                  onClick={() => cambiarEstado(row.id_p as number, "Pendiente")}
                  aria-label={`Reactivar permiso #${row.id_p}`}
                  title="Volver a poner pendiente"
                  className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200/80 rounded-xl transition-all hover:scale-105"
                >
                  <FaUndo size={12} />
                </button>
              )}
            </div>
          )}
        />
      </div>

      <Modal
        open={detallesModal.open}
        onClose={() => setDetallesModal({ open: false, permiso: null, detalles: [], loading: false })}
        title={`Desglose del Permiso #${detallesModal.permiso?.id_p || ""}`}
        size="lg"
      >
        <div className="space-y-4">
          {detallesModal.permiso && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] text-xs">
              <div>
                <span className="text-[var(--text-muted)] font-medium">Permiso ID:</span>
                <p className="text-sm font-bold text-[var(--text-primary)]">#{String(detallesModal.permiso.id_p)}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Tipo:</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{String(detallesModal.permiso.tipo || "Normal")}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Estado:</span>
                <div className="mt-0.5">{renderBadgeEstado(detallesModal.permiso.estado as string)}</div>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Fecha Solicitud:</span>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {formatFechaHora(detallesModal.permiso.fecha_creacion as string)}
                </p>
              </div>
            </div>
          )}

          <h4 className="text-sm font-semibold text-[var(--text-primary)] pt-2">
            Bloques Horarios Solicitados:
          </h4>

          {detallesModal.loading ? (
            <Spinner size="md" />
          ) : detallesModal.detalles.length > 0 ? (
            <TablaGenerica
              columnas={columnasDetalles}
              datos={detallesModal.detalles}
              mensajeVacio="No hay bloques registrados"
            />
          ) : (
            <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-center text-sm text-[var(--text-secondary)]">
              No se encontraron bloques detallados para esta solicitud.
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDetallesModal({ open: false, permiso: null, detalles: [], loading: false })}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
