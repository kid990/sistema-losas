import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaSave, FaTimes, FaPlus, FaToggleOn, FaToggleOff, FaSearch } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Badge } from "~/shared/components/ui";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const disciplinas = await api.get("/disciplinas/", request);
  return data({ disciplinas: (disciplinas as Record<string, unknown>).data || disciplinas || [] });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const fd = await request.formData();
  const intent = fd.get("intent") as string;
  const id_d = fd.get("id_d");

  if (intent === "toggleState") {
    const nuevoEstado = fd.get("estado") as string;
    await api.patch(`/disciplinas/${id_d}/estado`, request, { estado: nuevoEstado });
    return data({ ok: true });
  }

  const nombre = (fd.get("nombre") as string)?.trim();
  if (!nombre && intent !== "delete") {
    return data({ error: "Nombre requerido" }, { status: 400 });
  }

  if (intent === "create") {
    await api.post("/disciplinas/", request, { nombre });
  }
  if (intent === "update") {
    await api.put(`/disciplinas/${id_d}`, request, { nombre });
  }
  if (intent === "delete") {
    await api.delete(`/disciplinas/${id_d}`, request);
  }

  return data({ ok: true });
}

export default function AdminDisciplinas() {
  const { disciplinas } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [formData, setFormData] = useState<{ id_d: number | null; nombre: string }>({ id_d: null, nombre: "" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const list = (disciplinas as Record<string, unknown>[]) || [];

  const filteredDisciplinas = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((d) => String(d.nombre || "").toLowerCase().includes(q) || String(d.estado || "").toLowerCase().includes(q));
  }, [list, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = formData.nombre.trim();
    if (!nombre) {
      Swal.fire({
        icon: "warning",
        title: "Campo requerido",
        text: "Por favor ingresa un nombre para la disciplina deportiva.",
      });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("intent", formData.id_d ? "update" : "create");
      fd.append("nombre", nombre);
      if (formData.id_d) fd.append("id_d", String(formData.id_d));

      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();

      if (result.error) {
        Swal.fire({ icon: "error", title: "Error", text: result.error });
      } else {
        Swal.fire({
          icon: "success",
          title: formData.id_d ? "Disciplina modificada" : "Disciplina registrada",
          text: `La disciplina "${nombre}" se guardó correctamente.`,
          timer: 1800,
          showConfirmButton: false,
        });
        setFormData({ id_d: null, nombre: "" });
        revalidate();
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "Error al procesar la solicitud",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleState = async (id: number, estadoActual: string, nombre: string) => {
    const nuevoEstado = estadoActual === "Activo" ? "Inactivo" : "Activo";
    try {
      const fd = new FormData();
      fd.append("intent", "toggleState");
      fd.append("id_d", String(id));
      fd.append("estado", nuevoEstado);
      await fetch("", { method: "post", body: fd });
      revalidate();
      Swal.fire({
        icon: "info",
        title: `Disciplina ${nuevoEstado}`,
        text: `"${nombre}" ahora está ${nuevoEstado.toLowerCase()}.`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "Error al cambiar estado",
      });
    }
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar disciplina?",
      text: `Se eliminará la disciplina "${row.nombre}". Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EC5252",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      const fd = new FormData();
      fd.append("intent", "delete");
      fd.append("id_d", String(row.id_d));
      await fetch("", { method: "post", body: fd });
      if (formData.id_d === row.id_d) setFormData({ id_d: null, nombre: "" });
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Eliminada",
        text: "La disciplina ha sido eliminada.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "Error al eliminar disciplina",
      });
    }
  };

  const columns = [
    { name: "#", selector: (_: Record<string, unknown>, i?: number) => String((i || 0) + 1), width: "60px", sortable: false },
    { name: "Nombre de Disciplina", selector: (d: Record<string, unknown>) => (d.nombre as string) || "-", sortable: true },
    {
      name: "Estado",
      cell: (d: Record<string, unknown>) => {
        const est = (d.estado as string) || "Activo";
        return (
          <Badge variant={est === "Activo" ? "success" : "danger"} dot>
            {est}
          </Badge>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Gestión de Disciplinas Deportivas</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Configura los deportes y tipos de actividad que se pueden practicar en las losas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario Lateral */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card-theme p-6 space-y-4 sticky top-24">
            <h3 className="font-semibold text-lg text-[var(--text-primary)]">
              {formData.id_d ? "Editar Disciplina" : "Nueva Disciplina"}
            </h3>

            <Input
              label="Nombre de la Disciplina *"
              name="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej. Futsal, Vóley, Básquet"
              required
            />

            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={loading} className="flex-1">
                {formData.id_d ? <><FaSave /> Guardar</> : <><FaPlus /> Registrar</>}
              </Button>
              {formData.id_d && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setFormData({ id_d: null, nombre: "" })}
                >
                  <FaTimes />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Listado Principal con TablaGenerica */}
        <div className="lg:col-span-2">
          <div className="card-theme p-6">
            <div className="mb-4 max-w-md">
              <Input
                placeholder="Buscar disciplina..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<FaSearch />}
              />
            </div>

            <TablaGenerica
              columnas={columns}
              datos={filteredDisciplinas}
              titulo="Disciplinas Registradas"
              mensajeVacio="No hay disciplinas registradas"
              submensajeVacio={search ? "Prueba cambiando la búsqueda" : "Crea una disciplina desde el panel izquierdo"}
              acciones={(row: Record<string, unknown>) => {
                const est = (row.estado as string) || "Activo";
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleState(row.id_d as number, est, row.nombre as string)}
                      aria-label={est === "Activo" ? `Desactivar disciplina ${row.nombre}` : `Activar disciplina ${row.nombre}`}
                      title={est === "Activo" ? "Desactivar" : "Activar"}
                      className={`p-1.5 rounded-lg text-lg transition-colors ${
                        est === "Activo"
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-[var(--text-muted)] hover:bg-gray-100"
                      }`}
                    >
                      {est === "Activo" ? <FaToggleOn /> : <FaToggleOff />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ id_d: row.id_d as number, nombre: row.nombre as string })}
                      aria-label={`Editar disciplina ${row.nombre}`}
                      title="Editar disciplina"
                      className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      aria-label={`Eliminar disciplina ${row.nombre}`}
                      title="Eliminar disciplina"
                      className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
