import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data, redirect } from "react-router";
import Swal from "sweetalert2";
import { FaEdit, FaTrash, FaSave, FaPlus, FaToggleOn, FaToggleOff, FaSearch } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Badge, Modal } from "~/shared/components/ui";

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
    return redirect(new URL(request.url).pathname);
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

  return redirect(new URL(request.url).pathname);
}

export default function AdminDisciplinas() {
  const { disciplinas } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [formData, setFormData] = useState<{ id_d: number | null; nombre: string }>({ id_d: null, nombre: "" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const closeModal = () => {
    if (loading) return;
    setModalOpen(false);
    setFormData({ id_d: null, nombre: "" });
  };

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
        setModalOpen(false);
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-200 text-xl font-bold">
            ⚽
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Gestión de Disciplinas Deportivas
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Configura los deportes y tipos de actividad que se pueden practicar en las losas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setFormData({ id_d: null, nombre: "" }); setModalOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 shadow-md shadow-purple-200 hover:scale-[1.02] hover:shadow-lg transition-all"
        >
          <FaPlus size={12} aria-hidden="true" />
          Nueva Disciplina
        </button>
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={formData.id_d ? "Editar disciplina" : "Nueva disciplina"}>
          <form onSubmit={handleSubmit} className="space-y-4">

            <Input
              label="Nombre de la Disciplina *"
              name="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej. Futsal, Vóley, Básquet"
              required
              disabled={loading}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-theme">
              <Button type="button" variant="secondary" onClick={closeModal} disabled={loading}>Cancelar</Button>
              <Button type="submit" loading={loading}>
                {formData.id_d ? <><FaSave /> Guardar</> : <><FaPlus /> Registrar</>}
              </Button>
            </div>
          </form>
      </Modal>

      {/* Listado Principal con TablaGenerica */}
      <div className="card-theme p-6">
        <div className="mb-4 max-w-md">
          <Input
            aria-label="Buscar disciplinas"
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
          submensajeVacio={search ? "Prueba cambiando la búsqueda" : "Usa el botón superior para registrar una disciplina"}
          acciones={(row: Record<string, unknown>) => {
            const est = (row.estado as string) || "Activo";
            return (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleState(row.id_d as number, est, row.nombre as string)}
                  aria-label={est === "Activo" ? `Desactivar disciplina ${row.nombre}` : `Activar disciplina ${row.nombre}`}
                  title={est === "Activo" ? "Desactivar" : "Activar"}
                  className={`p-2 rounded-xl text-lg transition-all hover:scale-105 ${
                    est === "Activo"
                      ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200/80"
                      : "text-slate-400 bg-slate-100 hover:bg-slate-200 ring-1 ring-slate-200"
                  }`}
                >
                  {est === "Activo" ? <FaToggleOn /> : <FaToggleOff />}
                </button>
                <button
                  type="button"
                  onClick={() => { setFormData({ id_d: row.id_d as number, nombre: row.nombre as string }); setModalOpen(true); }}
                  aria-label={`Editar disciplina ${row.nombre}`}
                  title="Editar disciplina"
                  className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200/80 rounded-xl transition-all hover:scale-105"
                >
                  <FaEdit size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  aria-label={`Eliminar disciplina ${row.nombre}`}
                  title="Eliminar disciplina"
                  className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200/80 rounded-xl transition-all hover:scale-105"
                >
                  <FaTrash size={14} />
                </button>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
