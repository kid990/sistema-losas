import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data, redirect } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Button, Modal, Select, Badge, Input } from "~/shared/components/ui";
import { FaPencilAlt, FaSyncAlt, FaSearch } from "react-icons/fa";
import Swal from "sweetalert2";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const usuarios = await api.get("/users/", request);
  return data({ usuarios: (usuarios as Record<string, unknown>).data || usuarios });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "loadAll") {
    await api.post("/users/cargar", request);
  }

  if (intent === "changeState") {
    await api.put("/users/estado", request, {
      codigo: formData.get("codigo"),
      estado: formData.get("estado"),
    });
  }

  return redirect(new URL(request.url).pathname);
}

export default function AdminUsuarios() {
  const { usuarios } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [filtro, setFiltro] = useState("");
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [selectedEstado, setSelectedEstado] = useState("Activo");
  const [editModal, setEditModal] = useState<{ open: boolean; user: Record<string, unknown> | null }>({
    open: false,
    user: null,
  });

  const lista = (usuarios as Record<string, unknown>[]) || [];

  const datosFiltrados = useMemo(() => {
    if (!filtro.trim()) return lista;
    const texto = filtro.toLowerCase();
    return lista.filter((u) => {
      return (
        String(u.codigo || "").toLowerCase().includes(texto) ||
        String(u.nombre_completo || "").toLowerCase().includes(texto) ||
        String(u.escuela || "").toLowerCase().includes(texto) ||
        String(u.rol || "").toLowerCase().includes(texto) ||
        String(u.estado || "").toLowerCase().includes(texto)
      );
    });
  }, [lista, filtro]);

  const handleLoadAll = async () => {
    const result = await Swal.fire({
      title: "¿Sincronizar usuarios con padrón UNHEVAL?",
      text: "Esta operación sincronizará masivamente la base de estudiantes y docentes.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#1B6EB6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, sincronizar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    setLoadingSync(true);
    try {
      const fd = new FormData();
      fd.append("intent", "loadAll");
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error en la carga masiva");
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Usuarios sincronizados",
        text: "El padrón de usuarios se ha actualizado correctamente.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error de sincronización",
        text: err instanceof Error ? err.message : "No se pudo completar la carga",
      });
    } finally {
      setLoadingSync(false);
    }
  };

  const openEditModal = (user: Record<string, unknown>) => {
    setSelectedEstado((user.estado as string) || "Activo");
    setEditModal({ open: true, user });
  };

  const handleStateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.user) return;

    setLoadingModal(true);
    try {
      const fd = new FormData();
      fd.append("intent", "changeState");
      fd.append("codigo", editModal.user.codigo as string);
      fd.append("estado", selectedEstado);
      const res = await fetch("", { method: "post", body: fd });
      if (!res.ok) throw new Error("Error al cambiar estado");

      setEditModal({ open: false, user: null });
      revalidate();
      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `El usuario ahora se encuentra en estado "${selectedEstado}".`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "Error al actualizar estado",
      });
    } finally {
      setLoadingModal(false);
    }
  };

  const columns = [
    { name: "#", selector: (_: Record<string, unknown>, i?: number) => String((i || 0) + 1), width: "60px", sortable: false },
    { name: "Código Universitario", selector: (r: Record<string, unknown>) => (r.codigo as string) || "-", sortable: true },
    { name: "Nombre Completo", selector: (r: Record<string, unknown>) => (r.nombre_completo as string) || "-", sortable: true },
    { name: "Escuela / Facultad", selector: (r: Record<string, unknown>) => (r.escuela as string) || "-", sortable: true },
    { name: "Rol Académico", selector: (r: Record<string, unknown>) => (r.rol as string) || "-", sortable: true },
    {
      name: "Estado",
      cell: (r: Record<string, unknown>) => {
        const est = (r.estado as string) || "Activo";
        return (
          <Badge variant={est === "Activo" ? "success" : "danger"} dot>
            {est}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-indigo-200 text-xl font-bold">
            👥
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Gestión de Usuarios (Padrón UNHEVAL)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Consulta y gestiona el estado de estudiantes y docentes autorizados para reservar
            </p>
          </div>
        </div>
        <Button onClick={handleLoadAll} loading={loadingSync}>
          <FaSyncAlt aria-hidden="true" /> Sincronizar Padrón
        </Button>
      </div>

      <div className="card-theme p-6">
        <div className="mb-4 max-w-md">
          <Input
            aria-label="Buscar usuarios"
            placeholder="Buscar por código, nombre, escuela o estado..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={columns}
          datos={datosFiltrados}
          titulo="Usuarios Registrados"
          mensajeVacio="No se encontraron usuarios"
          submensajeVacio={filtro ? "Prueba con otros términos de búsqueda" : "Sincroniza el padrón con el botón superior"}
          acciones={(row: Record<string, unknown>) => (
            <button
              type="button"
              onClick={() => openEditModal(row)}
              aria-label={`Editar estado de ${row.nombre_completo}`}
              title="Cambiar estado de usuario"
              className="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200/80 rounded-xl transition-all hover:scale-105"
            >
              <FaPencilAlt size={14} />
            </button>
          )}
        />
      </div>

      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, user: null })}
        title="Cambiar Estado de Usuario"
        size="md"
      >
        <form onSubmit={handleStateChange} className="space-y-4">
          <div className="p-3.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)]">
            <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Usuario seleccionado</p>
            <p className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
              {editModal.user?.nombre_completo as string}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Código: <span className="font-mono font-medium">{editModal.user?.codigo as string}</span> • Escuela: {editModal.user?.escuela as string || "-"}
            </p>
          </div>

          <Select
            label="Estado del Usuario *"
            value={selectedEstado}
            onChange={(e) => setSelectedEstado(e.target.value)}
            options={[
              { value: "Activo", label: "Activo (Permite Reservas)" },
              { value: "Inactivo", label: "Inactivo (Bloqueado)" },
            ]}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditModal({ open: false, user: null })}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={loadingModal}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
