import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { FaEdit, FaTrash, FaPlus, FaSearch } from "react-icons/fa";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Modal, Input, Select, Badge } from "~/shared/components/ui";
import Swal from "sweetalert2";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const [losas, disciplinas] = await Promise.all([
    api.get("/losas", request),
    api.get("/disciplinas", request),
  ]);
  return data({
    losas: (losas as Record<string, unknown>).data || losas,
    disciplinas: (disciplinas as Record<string, unknown>).data || disciplinas,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create" || intent === "update") {
    const id_l = formData.get("id_l") as string | null;
    const payload = {
      nombre: formData.get("nombre"),
      numero_l: formData.get("numero_l"),
      ubicacion: formData.get("ubicacion"),
      dimensiones: formData.get("dimensiones"),
      superficie: formData.get("superficie"),
      iluminacion: formData.get("iluminacion"),
      id_d: formData.get("id_d"),
      estado: formData.get("estado") || "Disponible",
    };

    if (intent === "update" && id_l) {
      await api.put(`/losas/${id_l}`, request, payload);
    } else {
      await api.post("/losas", request, payload);
    }
  }

  if (intent === "delete") {
    const id = Number(formData.get("id_l"));
    await api.delete(`/losas/${id}`, request);
  }

  return data({ ok: true });
}

export default function AdminLosas() {
  const { losas, disciplinas } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    numero_l: "",
    ubicacion: "",
    dimensiones: "",
    superficie: "",
    iluminacion: "",
    id_d: "",
    estado: "Disponible",
  });

  const losasList = (losas as Record<string, unknown>[]) || [];
  const discList = (disciplinas as Record<string, unknown>[]) || [];

  const filteredLosas = useMemo(() => {
    if (!search.trim()) return losasList;
    const q = search.toLowerCase();
    return losasList.filter(
      (l) =>
        String(l.nombre || "").toLowerCase().includes(q) ||
        String(l.numero_l || "").toLowerCase().includes(q) ||
        String(l.ubicacion || "").toLowerCase().includes(q) ||
        String(l.nombre_disciplina || "").toLowerCase().includes(q) ||
        String(l.estado || "").toLowerCase().includes(q)
    );
  }, [losasList, search]);

  const openNew = () => {
    setEditing(null);
    setForm({
      nombre: "",
      numero_l: "",
      ubicacion: "",
      dimensiones: "",
      superficie: "",
      iluminacion: "",
      id_d: "",
      estado: "Disponible",
    });
    setShowModal(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setForm({
      nombre: (row.nombre as string) || "",
      numero_l: (row.numero_l as string) || "",
      ubicacion: (row.ubicacion as string) || "",
      dimensiones: (row.dimensiones as string) || "",
      superficie: (row.superficie as string) || "",
      iluminacion: (row.iluminacion as string) || "",
      id_d: String(row.id_d as number) || "",
      estado: (row.estado as string) || "Disponible",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.numero_l.trim() || !form.ubicacion.trim() || !form.id_d) {
      Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Por favor complete todos los campos obligatorios (*).",
      });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("intent", editing ? "update" : "create");
      if (editing) fd.append("id_l", String(editing.id_l));
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error al guardar la losa");
      setShowModal(false);
      revalidate();
      Swal.fire({
        icon: "success",
        title: editing ? "Losa actualizada" : "Losa registrada",
        text: `La losa "${form.nombre}" se guardó correctamente.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "Error desconocido al procesar la solicitud",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const result = await Swal.fire({
      title: "¿Eliminar esta losa?",
      text: `Se eliminará la losa "${row.nombre}". Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC5252",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const fd = new FormData();
      fd.append("intent", "delete");
      fd.append("id_l", String(row.id_l));
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error al eliminar losa");
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Losa eliminada",
        text: "El registro ha sido eliminado exitosamente.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error al eliminar",
        text: err instanceof Error ? err.message : "Error desconocido al eliminar losa",
      });
    }
  };

  const columns = [
    { name: "Nombre", selector: (row: Record<string, unknown>) => row.nombre as string, sortable: true },
    { name: "Número", selector: (row: Record<string, unknown>) => row.numero_l as string, sortable: true },
    { name: "Ubicación", selector: (row: Record<string, unknown>) => (row.ubicacion as string) || "-", sortable: true },
    { name: "Disciplina", selector: (row: Record<string, unknown>) => (row.nombre_disciplina as string) || "-", sortable: true },
    {
      name: "Estado",
      cell: (row: Record<string, unknown>) => {
        const est = (row.estado as string) || "Disponible";
        const variantMap: Record<string, "success" | "warning" | "danger" | "neutral"> = {
          Disponible: "success",
          Mantenimiento: "warning",
          Inactiva: "danger",
        };
        return (
          <Badge variant={variantMap[est] || "neutral"} dot>
            {est}
          </Badge>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Gestión de Losas Deportivas</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Administra los campos deportivos, especificaciones y estados de disponibilidad.
          </p>
        </div>
        <Button onClick={openNew}>
          <FaPlus className="inline mr-1" /> Nueva Losa
        </Button>
      </div>

      <div className="card-theme p-6">
        <div className="mb-4 max-w-md">
          <Input
            placeholder="Buscar por nombre, número, disciplina, estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={columns}
          datos={filteredLosas}
          titulo="Listado de Losas"
          mensajeVacio="No se encontraron losas deportivas"
          submensajeVacio={search ? "Prueba cambiando los términos de búsqueda" : "Crea una nueva losa con el botón superior"}
          acciones={(row: Record<string, unknown>) => (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEdit(row)}
                aria-label={`Editar losa ${row.nombre}`}
                title="Editar losa"
                className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <FaEdit size={15} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row)}
                aria-label={`Eliminar losa ${row.nombre}`}
                title="Eliminar losa"
                className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <FaTrash size={15} />
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Editar Losa Deportiva" : "Nueva Losa Deportiva"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Nombre de la Losa *"
                placeholder="Ej. Losa Multiuso 1"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <Input
              label="Número / Código *"
              placeholder="Ej. L-01"
              value={form.numero_l}
              onChange={(e) => setForm({ ...form, numero_l: e.target.value })}
              required
            />
            <Input
              label="Ubicación en el Campus *"
              placeholder="Ej. Pabellón Central"
              value={form.ubicacion}
              onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
              required
            />
            <Input
              label="Dimensiones"
              placeholder="Ej. 28m x 15m"
              value={form.dimensiones}
              onChange={(e) => setForm({ ...form, dimensiones: e.target.value })}
            />
            <Input
              label="Superficie"
              placeholder="Ej. Cemento pulido / Sintético"
              value={form.superficie}
              onChange={(e) => setForm({ ...form, superficie: e.target.value })}
            />
            <Input
              label="Iluminación"
              placeholder="Ej. Reflectores LED"
              value={form.iluminacion}
              onChange={(e) => setForm({ ...form, iluminacion: e.target.value })}
            />
            <Select
              label="Disciplina Principal *"
              value={form.id_d}
              onChange={(e) => setForm({ ...form, id_d: e.target.value })}
              placeholder="Seleccione disciplina"
              required
              options={discList.map((d) => ({
                value: String(d.id_d),
                label: d.nombre as string,
              }))}
            />
            <Select
              label="Estado de Disponibilidad *"
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              options={[
                { value: "Disponible", label: "Disponible" },
                { value: "Mantenimiento", label: "En Mantenimiento" },
                { value: "Inactiva", label: "Inactiva" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {editing ? "Guardar Cambios" : "Crear Losa"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
