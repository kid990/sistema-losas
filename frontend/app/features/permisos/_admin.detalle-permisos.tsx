import { useState, useMemo } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { TablaGenerica } from "~/shared/components/TablaGenerica";
import { Input, Badge } from "~/shared/components/ui";
import { formatFecha } from "~/shared/utils/format";
import { FaSearch, FaListAlt } from "react-icons/fa";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const detalles = await api.get("/permisos/aceptado-detalle", request);
  return data({ detalles: (detalles as Record<string, unknown>).data || detalles || [] });
}

export default function AdminDetallePermisos() {
  const { detalles } = useLoaderData<typeof loader>();
  const [busqueda, setBusqueda] = useState("");

  const list = (detalles as Record<string, unknown>[]) || [];

  const detallesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return list;
    const q = busqueda.toLowerCase();
    return list.filter((row) => {
      const texto = `${row.id_l} ${row.fecha} ${row.hora_inicio} ${row.hora_fin} ${row.estado} ${row.nombre} ${row.id_p}`.toLowerCase();
      return texto.includes(q);
    });
  }, [list, busqueda]);

  const columns = [
    { name: "ID Permiso", selector: (r: Record<string, unknown>) => `#${r.id_p}`, width: "110px", sortable: true },
    { name: "Losa Deportiva", selector: (r: Record<string, unknown>) => `Campo #${r.id_l}`, width: "130px", sortable: true },
    { name: "Disciplina", selector: (r: Record<string, unknown>) => (r.nombre as string) || (r.disciplina as string) || "General", sortable: true },
    { name: "Fecha de Uso", selector: (r: Record<string, unknown>) => formatFecha(r.fecha as string), sortable: true },
    { name: "Hora Inicio", selector: (r: Record<string, unknown>) => (r.hora_inicio as string)?.substring(0, 5) || "-", width: "110px", sortable: true },
    { name: "Hora Fin", selector: (r: Record<string, unknown>) => (r.hora_fin as string)?.substring(0, 5) || "-", width: "110px", sortable: true },
    {
      name: "Estado",
      cell: () => <Badge variant="success" dot>Aprobado</Badge>,
      width: "120px",
      sortable: true,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
            <FaListAlt className="text-[var(--color-primary-500)]" /> Desglose de Permisos Aprobados
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Vista desagregada por bloque horario y campo asignado de todas las reservas vigentes.
          </p>
        </div>
      </div>

      <div className="card-theme p-6">
        <div className="mb-4 max-w-md">
          <Input
            placeholder="Buscar por ID, losa, disciplina, fecha u hora..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            icon={<FaSearch />}
          />
        </div>

        <TablaGenerica
          columnas={columns}
          datos={detallesFiltrados}
          titulo="Bloques Horarios Autorizados"
          mensajeVacio="No se encontraron registros"
          submensajeVacio={busqueda ? "Prueba con otros términos de búsqueda" : "Aún no hay permisos aceptados con bloques asignados."}
        />
      </div>
    </div>
  );
}
