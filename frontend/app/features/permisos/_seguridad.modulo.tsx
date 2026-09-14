import { useState, useMemo } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { FaEye, FaFilePdf, FaSearch, FaShieldAlt } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { API_BASE_URL } from "~/lib/constants";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Modal, Badge, Spinner } from "~/shared/components/ui";
import { formatFecha } from "~/shared/utils/format";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Seguridad");
  const permisos = await api.get("/permisos/aceptado-detalle", request);
  return data({ permisos: (permisos as Record<string, unknown>).data || permisos || [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Seguridad");
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

  if (intent === "documento") {
    const res = await api.get(`/permisos/${fd.get("id_p")}/documento`, request);
    return data({ ok: true, data: res });
  }

  return data({ ok: false });
}

export default function SeguridadModulo() {
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
      const texto = `${p.id_p} ${p.id_l} ${p.estado} ${p.nombre} ${p.fecha} ${p.hora_inicio} ${p.hora_fin} ${p.numero_l} ${p.tipo}`.toLowerCase();
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
        text: "No se pudieron cargar los detalles de los bloques horarios.",
      });
      setDetallesModal((s) => ({ ...s, loading: false }));
    }
  };

  const verDocumento = async (idP: number) => {
    try {
      const fd = new FormData();
      fd.append("intent", "documento");
      fd.append("id_p", String(idP));
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (result.data?.success && result.data?.url_drive) {
        window.open(result.data.url_drive, "_blank");
      } else {
        Swal.fire({
          icon: "info",
          title: "Sin documento",
          text: "Esta solicitud no cuenta con documento de autorización adjunto.",
        });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo acceder al documento de autorización.",
      });
    }
  };

  const columns = [
    { name: "ID", selector: (r: Record<string, unknown>) => `#${r.id_p}`, width: "80px", sortable: true },
    { name: "Losa N°", selector: (r: Record<string, unknown>) => (r.numero_l as string) || `L-${r.id_l}`, sortable: true },
    { name: "Disciplina", selector: (r: Record<string, unknown>) => (r.nombre as string) || "-", sortable: true },
    { name: "Fecha de Uso", selector: (r: Record<string, unknown>) => formatFecha(r.fecha as string), sortable: true },
    { name: "Horario", selector: (r: Record<string, unknown>) => `${r.hora_inicio} - ${r.hora_fin}`, sortable: true },
    {
      name: "Tipo",
      cell: (r: Record<string, unknown>) => (
        <Badge variant={r.tipo === "Especial" ? "info" : "primary"}>
          {String(r.tipo || "Normal")}
        </Badge>
      ),
    },
    {
      name: "Autorización",
      cell: (r: Record<string, unknown>) =>
        r.tipo === "Especial" && r.tiene_documento ? (
          <button
            type="button"
            onClick={() => verDocumento(r.id_p as number)}
            aria-label={`Ver documento PDF del permiso #${r.id_p}`}
            title="Ver Documento PDF"
            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <FaFilePdf size={14} /> PDF
          </button>
        ) : (
          <span className="text-[var(--text-muted)] text-xs font-mono">Regular</span>
        ),
    },
    {
      name: "Estado",
      cell: () => (
        <Badge variant="success" dot>
          Autorizado
        </Badge>
      ),
    },
  ];

  const columnasDetalles = [
    { name: "ID Bloque", selector: (r: Record<string, unknown>) => `#${r.id_p}`, width: "90px" },
    { name: "Losa", selector: (r: Record<string, unknown>) => (r.id_l ? `Losa #${r.id_l}` : "-") },
    { name: "Disciplina", selector: (r: Record<string, unknown>) => (r.disciplina as string) || (r.nombre as string) || "N/A" },
    { name: "Fecha", selector: (r: Record<string, unknown>) => formatFecha(r.fecha as string) },
    { name: "Hora Inicio", selector: (r: Record<string, unknown>) => (r.hora_inicio as string) || "-" },
    { name: "Hora Fin", selector: (r: Record<string, unknown>) => (r.hora_fin as string) || "-" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
            <FaShieldAlt className="text-[#003366]" /> Control de Acceso y Permisos Aprobados
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Verificación en garita de permisos vigentes para ingreso a las losas deportivas de la UNHEVAL.
          </p>
        </div>
      </div>

      <div className="card-theme p-6">
        <div className="mb-4 max-w-md">
          <Input
            placeholder="Buscar por ID, fecha, horario, losa o disciplina..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={columns}
          datos={filtrados}
          titulo="Permisos Aprobados para Ingreso"
          mensajeVacio="No se encontraron permisos aprobados"
          submensajeVacio={busqueda ? "Prueba cambiando los criterios de búsqueda" : "No hay permisos vigentes para mostrar"}
          acciones={(row: Record<string, unknown>) => (
            <button
              type="button"
              onClick={() => verDetalles(row)}
              aria-label={`Ver detalles del permiso #${row.id_p}`}
              title="Ver desglose de horario"
              className="p-2 text-[var(--color-primary-600)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] rounded-lg transition-colors"
            >
              <FaEye size={15} />
            </button>
          )}
        />
      </div>

      <Modal
        open={detallesModal.open}
        onClose={() => setDetallesModal({ open: false, permiso: null, detalles: [], loading: false })}
        title={`Desglose de Permiso #${detallesModal.permiso?.id_p || ""}`}
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
                <span className="text-[var(--text-muted)] font-medium">Losa:</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{String(detallesModal.permiso.numero_l || `L-${detallesModal.permiso.id_l}`)}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Tipo:</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{String(detallesModal.permiso.tipo || "Normal")}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] font-medium">Estado:</span>
                <div>
                  <Badge variant="success" dot>Autorizado</Badge>
                </div>
              </div>
            </div>
          )}

          <h4 className="text-sm font-semibold text-[var(--text-primary)] pt-2">
            Bloques Horarios Asignados:
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
