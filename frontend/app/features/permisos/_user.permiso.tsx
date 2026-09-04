import { useState, useMemo } from "react";
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { FaEye, FaFilePdf, FaSearch, FaHistory } from "react-icons/fa";
import { requireAuth } from "~/services/auth.server";
import { api, ApiError, responseHeadersWithCookies } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Modal, Badge, Spinner } from "~/shared/components/ui";
import { formatFecha, formatFechaHora } from "~/shared/utils/format";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario") {
    throw new Response("No autorizado", { status: 403 });
  }
  const permisos = await api.get(`/permisos/usuario/${user.id}`, request);
  return data(
    { permisos: (permisos as Record<string, unknown>).data || permisos || [] },
    { headers: responseHeadersWithCookies(request) },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario") {
    throw new Response("No autorizado", { status: 403 });
  }

  const fd = await request.formData();
  const intent = fd.get("intent") as string;
  const rawId = fd.get("id_p");
  const idP = typeof rawId === "string" ? Number(rawId) : NaN;

  if ((intent === "detalles" || intent === "documento") && (!Number.isInteger(idP) || idP <= 0)) {
    return data({ ok: false, error: "ID de permiso inválido" }, { status: 400 });
  }

  if (intent === "detalles") {
    try {
      const res = await api.get(`/permisos/detalles/${idP}`, request);
      return data(
        { ok: true, data: (res as Record<string, unknown>).data || [] },
        { headers: responseHeadersWithCookies(request) },
      );
    } catch (err) {
      if (err instanceof ApiError) {
        return data(
          { ok: false, error: err.message },
          { status: err.status, headers: responseHeadersWithCookies(request) },
        );
      }
      return data({ ok: false, error: "Error al cargar detalles" }, { status: 500 });
    }
  }

  if (intent === "documento") {
    try {
      const res = await api.get(`/permisos/${idP}/documento`, request);
      return data(
        { ok: true, data: res },
        { headers: responseHeadersWithCookies(request) },
      );
    } catch (err) {
      if (err instanceof ApiError) {
        return data(
          { ok: false, error: err.message },
          { status: err.status, headers: responseHeadersWithCookies(request) },
        );
      }
      return data({ ok: false, error: "No se pudo obtener el documento" }, { status: 500 });
    }
  }

  return data({ ok: false, error: "Acción no válida" }, { status: 400 });
}

export default function UserPermiso() {
  const { permisos } = useLoaderData<typeof loader>();
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
      const texto = `${p.id_p} ${p.tipo} ${p.duracion_t} ${p.estado} ${formatFechaHora(p.fecha_creacion as string)}`.toLowerCase();
      return texto.includes(q);
    });
  }, [list, busqueda]);

  const verDetalles = async (permiso: Record<string, unknown>) => {
    setDetallesModal({ open: true, permiso, detalles: [], loading: true });
    try {
      const fd = new FormData();
      fd.append("intent", "detalles");
      fd.append("id_p", String(permiso.id_p));
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (!res.ok || result.ok === false) {
        throw new Error(result.error || "Error al cargar detalles");
      }
      setDetallesModal((s) => ({
        ...s,
        detalles: (result.data as Record<string, unknown>[]) || [],
        loading: false,
      }));
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: (err as Error).message || "No se pudieron cargar los detalles del permiso",
      });
      setDetallesModal((s) => ({ ...s, loading: false }));
    }
  };

  const verDocumento = async (idP: number) => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      Swal.fire({
        icon: "error",
        title: "Ventana bloqueada",
        text: "Permite las ventanas emergentes para ver el documento.",
      });
      return;
    }
    popup.opener = null;

    try {
      const fd = new FormData();
      fd.append("intent", "documento");
      fd.append("id_p", String(idP));
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (!res.ok || result.ok === false) {
        throw new Error(result.error || "No se pudo obtener el documento");
      }
      if (result.data?.success && result.data?.url_drive) {
        popup.location.href = result.data.url_drive;
      } else {
        popup.close();
        Swal.fire({
          icon: "info",
          title: "Sin documento",
          text: result.error || "No se adjuntó archivo a este permiso",
        });
      }
    } catch (err) {
      popup.close();
      Swal.fire({
        icon: "error",
        title: "Error",
        text: (err as Error).message || "No se pudo acceder al documento digital",
      });
    }
  };

  const renderBadgeEstado = (estado: string) => {
    switch (estado) {
      case "Aceptado":
      case "Aprobado":
        return <Badge variant="success" dot>Aceptado</Badge>;
      case "Pendiente":
        return <Badge variant="warning" dot>Pendiente</Badge>;
      case "Rechazado":
        return <Badge variant="danger" dot>Rechazado</Badge>;
      default:
        return <Badge variant="neutral">{estado || "No informado"}</Badge>;
    }
  };

  const formatDuracion = (value: unknown) => {
    const horas = Number(value);
    if (!Number.isFinite(horas)) return "No informado";
    return `${value} ${horas === 1 ? "hora" : "horas"}`;
  };

  const columns = [
    { name: "ID", selector: (r: Record<string, unknown>) => `#${r.id_p}`, width: "80px", sortable: true },
    {
      name: "Tipo",
      selector: (r: Record<string, unknown>) => String(r.tipo || "No informado"),
      cell: (r: Record<string, unknown>) => (
        <Badge variant={r.tipo === "Especial" ? "info" : "primary"}>
          {String(r.tipo || "No informado")}
        </Badge>
      ),
      sortable: true,
    },
    {
      name: "Duración",
      selector: (r: Record<string, unknown>) => formatDuracion(r.duracion_t),
      sortable: true,
    },
    {
      name: "Estado",
      selector: (r: Record<string, unknown>) => r.estado === "Aprobado" ? "Aceptado" : String(r.estado || "No informado"),
      cell: (r: Record<string, unknown>) => renderBadgeEstado(r.estado as string),
      sortable: true,
    },
    {
      name: "Adjunto",
      cell: (r: Record<string, unknown>) =>
        r.tipo === "Especial" ? (
          <button
            type="button"
            onClick={() => verDocumento(r.id_p as number)}
            aria-label={`Ver documento PDF adjunto del permiso #${r.id_p}`}
            title="Ver documento adjunto"
            className="min-h-11 min-w-11 px-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex flex-wrap items-center justify-center gap-1 text-xs font-semibold"
          >
            <FaFilePdf size={14} /> PDF
          </button>
        ) : (
          <span className="text-[var(--text-muted)] text-xs font-mono">Regular</span>
        ),
    },
    {
      name: "Fecha Solicitud",
      selector: (r: Record<string, unknown>) => formatFechaHora(r.fecha_creacion as string),
      sortable: true,
    },
  ];

  const columnasDetalles = [
    { name: "ID Losa", selector: (r: Record<string, unknown>) => `Campo #${r.id_l}` },
    { name: "Ubicación", selector: (r: Record<string, unknown>) => (r.ubicacion as string) || "No informado" },
    {
      name: "Disciplina",
      selector: (r: Record<string, unknown>) => (r.disciplina as string) || "No informado",
    },
    {
      name: "Fecha de Uso",
      selector: (r: Record<string, unknown>) => formatFecha(r.fecha as string),
    },
    { name: "Horario", selector: (r: Record<string, unknown>) => `${r.hora_inicio} - ${r.hora_fin}` },
    { name: "Duración", selector: (r: Record<string, unknown>) => formatDuracion(r.duracion) },
  ];

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-theme-primary flex items-center gap-2">
          <FaHistory className="text-[var(--color-primary-500)]" /> Historial de Mis Permisos
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Consulta el estado y desglose de tus solicitudes de reserva de losas deportivas.
        </p>
      </div>

      <div className="card-theme min-w-0 p-3 sm:p-6">
        <div className="mb-4 max-w-md">
          <Input
            label="Buscar permisos"
            placeholder="Buscar por ID, tipo o fecha..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={columns}
          datos={filtrados}
          titulo="Mis Solicitudes Realizadas"
          mensajeVacio="No tienes permisos registrados"
          submensajeVacio={busqueda ? "No hay solicitudes con ese criterio" : "Realiza tu primera reserva desde la sección de horarios."}
          acciones={(row: Record<string, unknown>) => (
            <button
              type="button"
              onClick={() => verDetalles(row)}
              aria-label={`Ver desglose del permiso #${row.id_p}`}
              title="Ver desglose de la reserva"
              className="min-h-11 min-w-11 p-2 text-[var(--color-primary-600)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] rounded-lg transition-colors"
            >
              <FaEye size={15} />
            </button>
          )}
        />
        {!busqueda && list.length === 0 && (
          <div className="mt-4 text-center">
            <Link
              to="/horario"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)]"
            >
              Consultar horarios
            </Link>
          </div>
        )}
      </div>

      <Modal
        open={detallesModal.open}
        onClose={() => setDetallesModal({ open: false, permiso: null, detalles: [], loading: false })}
        title={`Desglose de Permiso #${detallesModal.permiso?.id_p || ""}`}
        size="lg"
      >
        <div className="min-w-0 space-y-4">
          {detallesModal.permiso && (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-4 gap-3 p-3 sm:p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] text-xs">
              <div>
                <span className="text-[var(--text-muted)] font-medium">Permiso:</span>
                <p className="text-sm font-bold text-[var(--text-primary)]">#{String(detallesModal.permiso.id_p)}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Tipo:</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{String(detallesModal.permiso.tipo || "No informado")}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Estado:</span>
                <div className="mt-0.5">
                  {renderBadgeEstado(detallesModal.permiso.estado as string)}
                </div>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Fecha Emisión:</span>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {formatFechaHora(detallesModal.permiso.fecha_creacion as string)}
                </p>
              </div>
            </div>
          )}

          <h4 className="text-sm font-semibold text-[var(--text-primary)] pt-2">
            Bloques Deportivos Reservados:
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

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
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
