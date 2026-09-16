import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data, redirect } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Input, Select, Modal, Badge } from "~/shared/components/ui";
import { FaPencilAlt, FaTrash, FaPlus, FaSearch } from "react-icons/fa";
import Swal from "sweetalert2";

const ROLES_OPTIONS = [
  { value: "Administrador", label: "Administrador" },
  { value: "Seguridad", label: "Personal de Seguridad" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const trabajadores = await api.get("/trabajadores", request);
  return data({ trabajadores: (trabajadores as Record<string, unknown>).data || trabajadores });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "create") {
    const apellido_p = (fd.get("apellido_p") as string) || "";
    const apellido_m = (fd.get("apellido_m") as string) || "";
    await api.post("/trabajadores", request, {
      dni: fd.get("dni"),
      nombres: fd.get("nombres"),
      apellidos: `${apellido_p} ${apellido_m}`.trim(),
      email: fd.get("email"),
      password: fd.get("password"),
      telefono: fd.get("telefono"),
      rol: fd.get("rol"),
    });
  }
  if (intent === "update") {
    const apellido_p = (fd.get("apellido_p") as string) || "";
    const apellido_m = (fd.get("apellido_m") as string) || "";
    await api.put(`/trabajadores/${fd.get("id_t")}`, request, {
      nombres: fd.get("nombres"),
      apellidos: `${apellido_p} ${apellido_m}`.trim(),
      telefono: fd.get("telefono"),
      rol: fd.get("rol"),
    });
  }
  if (intent === "delete") {
    await api.delete(`/trabajadores/${fd.get("id_t")}`, request);
  }

  return redirect(new URL(request.url).pathname);
}

export default function AdminTrabajadores() {
  const { trabajadores } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{
    open: boolean;
    data: Record<string, unknown> | null;
    mode: "create" | "edit";
  }>({
    open: false,
    data: null,
    mode: "create",
  });

  const lista = (trabajadores as Record<string, unknown>[]) || [];

  const datosFiltrados = useMemo(() => {
    if (!filtro.trim()) return lista;
    const texto = filtro.toLowerCase();
    return lista.filter((t) => {
      const nombreCompleto = [t.nombres, t.apellido_p, t.apellido_m].filter(Boolean).join(" ");
      return (
        String(t.dni || "").includes(texto) ||
        nombreCompleto.toLowerCase().includes(texto) ||
        String(t.email || "").toLowerCase().includes(texto) ||
        String(t.rol || "").toLowerCase().includes(texto)
      );
    });
  }, [lista, filtro]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const dni = fd.get("dni") as string;

    if (modal.mode === "create" && (!dni || dni.length !== 8 || !/^\d{8}$/.test(dni))) {
      Swal.fire({
        icon: "warning",
        title: "DNI inválido",
        text: "El DNI debe contener exactamente 8 dígitos numéricos.",
      });
      return;
    }

    setLoading(true);
    try {
      fd.append("intent", modal.mode === "create" ? "create" : "update");
      if (modal.mode === "edit") fd.append("id_t", String(modal.data?.id_t));
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error al guardar el trabajador");

      setModal({ open: false, data: null, mode: "create" });
      revalidate();
      Swal.fire({
        icon: "success",
        title: modal.mode === "create" ? "Trabajador registrado" : "Trabajador actualizado",
        text: "Los datos han sido guardados exitosamente.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: err instanceof Error ? err.message : "Error desconocido al procesar la solicitud",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const nombre = [row.nombres, row.apellido_p].filter(Boolean).join(" ");
    const result = await Swal.fire({
      title: "¿Eliminar trabajador?",
      text: `Se dará de baja a "${nombre}". ¿Desea continuar?`,
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
      fd.append("id_t", String(row.id_t));
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error al eliminar trabajador");
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Trabajador eliminado",
        text: "El registro fue eliminado correctamente.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo eliminar el trabajador",
      });
    }
  };

  const columns = [
    { name: "#", selector: (_: Record<string, unknown>, i?: number) => String((i || 0) + 1), width: "60px", sortable: false },
    { name: "DNI", selector: (r: Record<string, unknown>) => (r.dni as string) || "-", sortable: true },
    { name: "Nombres", selector: (r: Record<string, unknown>) => (r.nombres as string) || "-", sortable: true },
    { name: "Apellidos", selector: (r: Record<string, unknown>) => [r.apellido_p, r.apellido_m].filter(Boolean).join(" ") || "-", sortable: true },
    { name: "Correo Electrónico", selector: (r: Record<string, unknown>) => (r.email as string) || "-", sortable: true },
    {
      name: "Rol",
      cell: (r: Record<string, unknown>) => {
        const rol = (r.rol as string) || "-";
        return (
          <Badge variant={rol === "Administrador" ? "primary" : "info"} dot>
            {rol}
          </Badge>
        );
      },
    },
    { name: "Teléfono", selector: (r: Record<string, unknown>) => (r.telefono as string) || "-", sortable: false },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-200 text-xl font-bold">
            💼
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Gestión de Personal y Trabajadores
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Administra personal administrativo y de seguridad con acceso al sistema
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, data: null, mode: "create" })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-200 hover:scale-[1.02] hover:shadow-lg transition-all"
        >
          <FaPlus size={12} aria-hidden="true" />
          Nuevo Trabajador
        </button>
      </div>

      <div className="card-theme p-6">
        <div className="mb-4 max-w-md">
          <Input
            aria-label="Buscar trabajadores"
            placeholder="Buscar por DNI, nombres, apellidos, correo o rol..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={columns}
          datos={datosFiltrados}
          titulo="Listado de Trabajadores"
          mensajeVacio="No se encontraron trabajadores"
          submensajeVacio={filtro ? "Prueba cambiando los términos de búsqueda" : "Registra un nuevo trabajador con el botón superior"}
          acciones={(row: Record<string, unknown>) => (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModal({ open: true, data: row, mode: "edit" })}
                aria-label={`Editar datos de ${row.nombres}`}
                title="Editar trabajador"
                className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200/80 rounded-xl transition-all hover:scale-105"
              >
                <FaPencilAlt size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row)}
                aria-label={`Eliminar trabajador ${row.nombres}`}
                title="Eliminar trabajador"
                className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200/80 rounded-xl transition-all hover:scale-105"
              >
                <FaTrash size={14} />
              </button>
            </div>
          )}
        />
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, data: null, mode: "create" })}
        title={modal.mode === "create" ? "Registrar Nuevo Trabajador" : "Editar Datos de Trabajador"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                name="nombres"
                label="Nombres *"
                placeholder="Ej. Juan Carlos"
                defaultValue={(modal.data?.nombres as string) || ""}
                required
              />
            </div>
            <Input
              name="apellido_p"
              label="Apellido Paterno *"
              placeholder="Ej. Pérez"
              defaultValue={(modal.data?.apellido_p as string) || ""}
              required
            />
            <Input
              name="apellido_m"
              label="Apellido Materno"
              placeholder="Ej. Gómez"
              defaultValue={(modal.data?.apellido_m as string) || ""}
            />
            <Input
              name="dni"
              label="DNI (8 dígitos) *"
              placeholder="12345678"
              defaultValue={(modal.data?.dni as string) || ""}
              required
              maxLength={8}
              disabled={modal.mode === "edit"}
            />
            <Input
              name="email"
              label="Correo Electrónico *"
              type="email"
              placeholder="usuario@unheval.edu.pe"
              defaultValue={(modal.data?.email as string) || ""}
              required
              disabled={modal.mode === "edit"}
            />
            <Input
              name="telefono"
              label="Teléfono / Celular"
              placeholder="Ej. 987654321"
              defaultValue={(modal.data?.telefono as string) || ""}
            />
            <Select
              name="rol"
              label="Rol en el Sistema *"
              defaultValue={(modal.data?.rol as string) || "Administrador"}
              options={ROLES_OPTIONS}
              required
            />
            {modal.mode === "create" && (
              <div className="md:col-span-2">
                <Input
                  name="password"
                  label="Contraseña Inicial (mínimo 4 caracteres) *"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={4}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal({ open: false, data: null, mode: "create" })}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              {modal.mode === "create" ? "Registrar" : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
