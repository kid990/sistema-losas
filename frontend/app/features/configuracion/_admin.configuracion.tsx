import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Modal } from "~/shared/components/ui";
import { FaEdit, FaTrash, FaPlus, FaSearch } from "react-icons/fa";

function formatFecha(fechaISO: string) {
  if (!fechaISO) return "";
  const parts = String(fechaISO).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(fechaISO).toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const [config, dias] = await Promise.all([
    api.get("/configuracion", request),
    api.get("/dias-bloqueados", request),
  ]);
  return data({
    config: (config as Record<string, unknown>) || null,
    dias: (dias as Record<string, unknown>).data || dias || [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "updateConfig") {
    const config = {
      hora_min_solicitud: fd.get("hora_min_solicitud"),
      hora_max_solicitud: fd.get("hora_max_solicitud"),
      hora_min_apertura: fd.get("hora_min_apertura"),
      hora_max_apertura: fd.get("hora_max_apertura"),
      restriccion_hoy: fd.get("restriccion_hoy"),
      max_horas_semana: Number(fd.get("max_horas_semana")),
    };
    await api.put("/configuracion", request, config);
  }

  if (intent === "addDia") {
    await api.post("/dias-bloqueados", request, {
      fecha: fd.get("fecha"),
      motivo: fd.get("motivo"),
    });
  }

  if (intent === "deleteDia") {
    await api.delete(`/dias-bloqueados/${fd.get("id")}`, request);
  }

  return data({ ok: true });
}

export default function AdminConfiguracion() {
  const { config, dias } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [configModal, setConfigModal] = useState(false);
  const [diaModal, setDiaModal] = useState(false);
  const [searchDias, setSearchDias] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingDia, setLoadingDia] = useState(false);
  const [formConfig, setFormConfig] = useState<Record<string, unknown>>(config || {});
  const [nuevoDia, setNuevoDia] = useState({ fecha: "", motivo: "" });

  const diasList = (dias as Record<string, unknown>[]) || [];

  const filteredDias = useMemo(() => {
    if (!searchDias.trim()) return diasList;
    const q = searchDias.toLowerCase();
    return diasList.filter(
      (d) =>
        String(d.motivo || "").toLowerCase().includes(q) ||
        String(d.fecha || "").toLowerCase().includes(q) ||
        formatFecha(d.fecha as string).includes(q)
    );
  }, [diasList, searchDias]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingConfig(true);
    try {
      const fd = new FormData();
      fd.append("intent", "updateConfig");
      Object.entries(formConfig).forEach(([k, v]) => fd.append(k, String(v)));
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error al guardar la configuración");
      Swal.fire({
        icon: "success",
        title: "Configuración actualizada",
        text: "Los parámetros del sistema se guardaron correctamente.",
        timer: 1800,
        showConfirmButton: false,
      });
      setConfigModal(false);
      revalidate();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo actualizar la configuración",
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleAddDia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoDia.fecha || !nuevoDia.motivo.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Ingresa la fecha y el motivo del bloqueo.",
      });
      return;
    }

    setLoadingDia(true);
    try {
      const fd = new FormData();
      fd.append("intent", "addDia");
      fd.append("fecha", nuevoDia.fecha);
      fd.append("motivo", nuevoDia.motivo);
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (result.error) {
        Swal.fire({ icon: "error", title: "Error", text: result.error });
      } else {
        Swal.fire({
          icon: "success",
          title: "Día bloqueado",
          text: `El día ${formatFecha(nuevoDia.fecha)} fue bloqueado exitosamente.`,
          timer: 1800,
          showConfirmButton: false,
        });
        setDiaModal(false);
        setNuevoDia({ fecha: "", motivo: "" });
        revalidate();
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "Error al registrar día bloqueado",
      });
    } finally {
      setLoadingDia(false);
    }
  };

  const handleDeleteDia = async (row: Record<string, unknown>) => {
    const confirm = await Swal.fire({
      title: "¿Desbloquear día?",
      text: `Se eliminará el bloqueo del ${formatFecha(row.fecha as string)} ("${row.motivo}").`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC5252",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, desbloquear",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      const fd = new FormData();
      fd.append("intent", "deleteDia");
      fd.append("id", String(row.id));
      await fetch("", { method: "post", body: fd });
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Día desbloqueado",
        text: "La fecha vuelve a estar disponible para reservas.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo eliminar el bloqueo",
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Configuración del Sistema</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Ajusta los horarios de atención, límites de reserva y días no laborables / feriados.
        </p>
      </div>

      {config && (
        <div className="card-theme p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Parámetros Horarios Globales</h2>
              <p className="text-xs text-[var(--text-secondary)]">Rango de horario de apertura de losas y políticas de solicitud.</p>
            </div>
            <Button onClick={() => { setFormConfig(config); setConfigModal(true); }}>
              <FaEdit className="inline mr-1" /> Editar Parámetros
            </Button>
          </div>
          <TablaGenerica
            columnas={[
              { name: "Hora Min. Solicitud", selector: (r: Record<string, unknown>) => (r.hora_min_solicitud as string) || "-" },
              { name: "Hora Max. Solicitud", selector: (r: Record<string, unknown>) => (r.hora_max_solicitud as string) || "-" },
              { name: "Hora Min. Apertura", selector: (r: Record<string, unknown>) => (r.hora_min_apertura as string) || "-" },
              { name: "Hora Max. Apertura", selector: (r: Record<string, unknown>) => (r.hora_max_apertura as string) || "-" },
              { name: "Restricción Hoy", selector: (r: Record<string, unknown>) => (r.restriccion_hoy as string) || "-" },
              { name: "Máx. Horas/Semana", selector: (r: Record<string, unknown>) => `${r.max_horas_semana || 0} hrs` },
            ]}
            datos={[config as Record<string, unknown>]}
          />
        </div>
      )}

      <div className="card-theme p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Días Bloqueados (Feriados y Mantenimiento)</h2>
            <p className="text-xs text-[var(--text-secondary)]">Fechas en las que no se permite reservar ninguna losa deportiva.</p>
          </div>
          <Button onClick={() => setDiaModal(true)}>
            <FaPlus className="inline mr-1" /> Bloquear Nueva Fecha
          </Button>
        </div>

        <div className="mb-4 max-w-md">
          <Input
            placeholder="Buscar fecha o motivo..."
            value={searchDias}
            onChange={(e) => setSearchDias(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={[
            { name: "Fecha Bloqueada", selector: (r: Record<string, unknown>) => formatFecha(r.fecha as string), sortable: true },
            { name: "Motivo / Festividad", selector: (r: Record<string, unknown>) => (r.motivo as string) || "-", sortable: true },
          ]}
          datos={filteredDias}
          titulo="Fechas No Disponibles"
          mensajeVacio="No hay días bloqueados"
          submensajeVacio={searchDias ? "Prueba cambiando el término de búsqueda" : "Agrega un feriado o mantenimiento con el botón superior"}
          acciones={(row: Record<string, unknown>) => (
            <button
              type="button"
              onClick={() => handleDeleteDia(row)}
              aria-label={`Eliminar bloqueo del ${formatFecha(row.fecha as string)}`}
              title="Desbloquear fecha"
              className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <FaTrash size={14} />
            </button>
          )}
        />
      </div>

      <Modal
        open={configModal}
        onClose={() => setConfigModal(false)}
        title="Editar Parámetros de Configuración"
        size="lg"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="hora_min_solicitud"
              label="Hora Mínima de Solicitud *"
              type="time"
              value={String(formConfig.hora_min_solicitud || "")}
              onChange={(e) => setFormConfig({ ...formConfig, hora_min_solicitud: e.target.value })}
              required
            />
            <Input
              name="hora_max_solicitud"
              label="Hora Máxima de Solicitud *"
              type="time"
              value={String(formConfig.hora_max_solicitud || "")}
              onChange={(e) => setFormConfig({ ...formConfig, hora_max_solicitud: e.target.value })}
              required
            />
            <Input
              name="hora_min_apertura"
              label="Hora Mínima de Apertura *"
              type="time"
              value={String(formConfig.hora_min_apertura || "")}
              onChange={(e) => setFormConfig({ ...formConfig, hora_min_apertura: e.target.value })}
              required
            />
            <Input
              name="hora_max_apertura"
              label="Hora Máxima de Apertura *"
              type="time"
              value={String(formConfig.hora_max_apertura || "")}
              onChange={(e) => setFormConfig({ ...formConfig, hora_max_apertura: e.target.value })}
              required
            />
            <Input
              name="restriccion_hoy"
              label="Hora Límite para Reserva Mismo Día *"
              type="time"
              value={String(formConfig.restriccion_hoy || "")}
              onChange={(e) => setFormConfig({ ...formConfig, restriccion_hoy: e.target.value })}
              required
            />
            <Input
              name="max_horas_semana"
              label="Máximo de Horas por Semana por Usuario *"
              type="number"
              min={1}
              max={40}
              value={String(formConfig.max_horas_semana || "")}
              onChange={(e) => setFormConfig({ ...formConfig, max_horas_semana: Number(e.target.value) })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfigModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loadingConfig}>
              Guardar Parámetros
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={diaModal}
        onClose={() => setDiaModal(false)}
        title="Bloquear Nueva Fecha"
        size="md"
      >
        <form onSubmit={handleAddDia} className="space-y-4">
          <Input
            name="fecha"
            label="Fecha a Bloquear *"
            type="date"
            value={nuevoDia.fecha}
            onChange={(e) => setNuevoDia({ ...nuevoDia, fecha: e.target.value })}
            required
          />
          <Input
            name="motivo"
            label="Motivo del Bloqueo *"
            placeholder="Ej. Feriado Nacional / Mantenimiento de losas"
            value={nuevoDia.motivo}
            onChange={(e) => setNuevoDia({ ...nuevoDia, motivo: e.target.value })}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDiaModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loadingDia}>
              Bloquear Fecha
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
