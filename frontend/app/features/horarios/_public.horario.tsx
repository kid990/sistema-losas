import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator, data } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import Swal from "sweetalert2";
import { requireAuth } from "~/services/auth.server";
import { api, ApiError, responseHeadersWithCookies } from "~/services/api.server";
import { Button, Modal, Select, Badge } from "~/shared/components/ui";
import {
  FaCheck,
  FaTimes,
  FaClock,
  FaCalendarAlt,
  FaFileUpload,
  FaInfoCircle,
} from "react-icons/fa";

interface Ocupado {
  id_l: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

interface Losa {
  id_l: number;
  nombre: string;
  numero_l: string;
  id_d: number;
}

interface Disciplina {
  id_d: number;
  nombre: string;
}

interface Config {
  hora_min_apertura: string;
  hora_max_apertura: string;
  restriccion_hoy: string;
  max_horas_semana: number;
}

interface Seleccion {
  losaId: number;
  horario: string;
}

const MAX_PDF_SIZE = 10 * 1024 * 1024;

const esPdfValido = (archivo: File) =>
  archivo.type === "application/pdf" &&
  archivo.name.toLowerCase().endsWith(".pdf") &&
  archivo.size > 0 &&
  archivo.size <= MAX_PDF_SIZE;

const fechaCivil = (valor: string) => valor.slice(0, 10);

const formatearFechaCivil = (valor: string) => {
  const [anio, mes, dia] = fechaCivil(valor).split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(anio, mes - 1, dia));
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario")
    throw new Response("No autorizado", { status: 403 });

  const [losasData, disciplinasData, configData, ocupadosData] =
    await Promise.all([
      api.get("/losas", request),
      api
        .get("/disciplinas/activas", request)
        .catch(() => api.get("/disciplinas/", request)),
      api.get("/configuracion", request),
      api
        .get("/permisos/bloqueados-detalle", request)
        .catch(() => ({ data: [], errorCarga: true })),
    ]);

  const losasAll = ((losasData as Record<string, unknown>).data ||
    losasData ||
    []) as (Losa & {
    estado?: string;
  })[];
  // Solo losas disponibles para reserva
  const losas = losasAll.filter(
    (l) => !l.estado || l.estado === "Disponible",
  ) as Losa[];
  const disciplinasRaw = ((disciplinasData as Record<string, unknown>).data ||
    disciplinasData ||
    []) as (Disciplina & {
    estado?: string;
  })[];
  const disciplinas = disciplinasRaw.filter(
    (d) => !d.estado || d.estado === "Activo",
  ) as Disciplina[];
  const config = (configData || null) as Config | null;
  const ocupados = ((ocupadosData as Record<string, unknown>).data ||
    ocupadosData ||
    []) as Ocupado[];
  const errorOcupados = Boolean(
    (ocupadosData as Record<string, unknown>).errorCarga,
  );

  return data(
    { losas, disciplinas, config, ocupados, errorOcupados, userId: user.id },
    { headers: responseHeadersWithCookies(request) },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario")
    throw new Response("No autorizado", { status: 403 });
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "reservar") {
    try {
      const tipo = fd.get("tipo") as string;
      const detalles = JSON.parse(fd.get("detalles") as string);
      const documento = fd.get("documento") as File | null;

      if (tipo === "Especial" && (!documento || !esPdfValido(documento))) {
        return data(
          {
            ok: false,
            error: "Adjunta un archivo PDF válido de hasta 10 MB.",
          },
          { status: 400, headers: responseHeadersWithCookies(request) },
        );
      }

      // Normalizar horarios a HH:MM:SS para Zod del backend
      const detallesNorm = detalles.map((d: Record<string, unknown>) => ({
        ...d,
        hora_inicio:
          String(d.hora_inicio).length === 5
            ? `${d.hora_inicio}:00`
            : d.hora_inicio,
        hora_fin:
          String(d.hora_fin).length === 5 ? `${d.hora_fin}:00` : d.hora_fin,
      }));

      if (tipo === "Normal") {
        await api.post("/permisos", request, {
          tipo: "Normal",
          id_u: user.id,
          duracion_t: detallesNorm.length,
          detalles: detallesNorm,
        });
      } else {
        const formData = new FormData();
        formData.append("tipo", "Especial");
        formData.append("id_u", String(user.id));
        formData.append("duracion_t", String(detallesNorm.length));
        formData.append("detalles", JSON.stringify(detallesNorm));
        if (documento && documento.size > 0) {
          formData.append("documento", documento);
        }

        await api.postForm("/permisos", request, formData);
      }

      return data({ ok: true }, { headers: responseHeadersWithCookies(request) });
    } catch (err) {
      if (err instanceof ApiError) {
        return data(
          { ok: false, error: err.message },
          { status: err.status, headers: responseHeadersWithCookies(request) },
        );
      }
      return data(
        { ok: false, error: "No se pudo registrar el permiso" },
        { status: 500, headers: responseHeadersWithCookies(request) },
      );
    }
  }

  return data({ ok: false, error: "Acción no válida" }, { status: 400 });
}

export default function HorarioPublic() {
  const { losas, disciplinas, config, ocupados, errorOcupados, userId } =
    useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const fechaHoy = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  }, []);

  const [tipoPermiso, setTipoPermiso] = useState("Normal");
  const [fecha, setFecha] = useState(fechaHoy);
  const [seleccionados, setSeleccionados] = useState<Seleccion[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [documento, setDocumento] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const getDisciplinaNombre = (id_d: number) =>
    disciplinas.find((x) => x.id_d === id_d)?.nombre || "No informado";

  const getEstadoHorario = (losaId: number, horario: string) => {
    const [horaInicio] = horario.split(" - ");
    const ocupado = ocupados.find(
      (o) =>
        o.id_l === losaId &&
        fechaCivil(o.fecha) === fecha &&
        o.hora_inicio.substring(0, 5) === horaInicio,
    );
    if (ocupado) return "Ocupado";

    if (fecha === fechaHoy) {
      const ahora = new Date();
      const horaActual = ahora.getHours();
      const minutosActual = ahora.getMinutes();
      const horaInicioNum = parseInt(horaInicio.split(":")[0], 10);

      if (
        horaActual > horaInicioNum ||
        (horaActual === horaInicioNum && minutosActual > 0)
      ) {
        return "Expirado";
      }
    }
    return "Disponible";
  };

  const horarios = useMemo(() => {
    if (!config) return [];
    const horaMin = Number(config.hora_min_apertura?.split(":")[0]);
    const horaMax = Number(config.hora_max_apertura?.split(":")[0]);
    if (
      !Number.isInteger(horaMin) ||
      !Number.isInteger(horaMax) ||
      horaMin < 0 ||
      horaMin > 23 ||
      horaMax < 1 ||
      horaMax > 24 ||
      horaMax <= horaMin
    ) {
      return [];
    }
    return Array.from({ length: horaMax - horaMin }, (_, i) => {
      const h = i + horaMin;
      return `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`;
    });
  }, [config]);

  const handleTipoPermisoChange = (tipo: string) => {
    setTipoPermiso(tipo);
    if (tipo === "Normal") setFecha(fechaHoy);
    setSeleccionados([]);
  };

  const handleFechaChange = (f: string) => {
    if (
      (tipoPermiso === "Normal" && f !== fechaHoy) ||
      (tipoPermiso === "Especial" && f < fechaHoy)
    )
      return;
    setFecha(f);
    setSeleccionados([]);
  };

  const toggleEstado = (losaId: number, horario: string) => {
    if (!tipoPermiso) {
      Swal.fire({ icon: "info", title: "Seleccione un tipo de permiso" });
      return;
    }
    if (tipoPermiso === "Normal" && fecha !== fechaHoy) {
      Swal.fire({ icon: "warning", title: "Permiso normal solo para hoy" });
      return;
    }

    const estado = getEstadoHorario(losaId, horario);
    if (estado !== "Disponible") return;

    if (tipoPermiso === "Normal") {
      setSeleccionados([{ losaId, horario }]);
      setShowModal(true);
    } else {
      const yaSel = seleccionados.some(
        (s) => s.losaId === losaId && s.horario === horario,
      );
      setSeleccionados((prev) =>
        yaSel
          ? prev.filter((s) => !(s.losaId === losaId && s.horario === horario))
          : [...prev, { losaId, horario }],
      );
    }
  };

  const confirmarReserva = async () => {
    if (tipoPermiso === "Especial" && (!documento || !esPdfValido(documento))) {
      Swal.fire({
        icon: "warning",
        title: "PDF requerido",
        text: "Adjunta un archivo PDF válido de hasta 10 MB como justificación del permiso especial.",
      });
      return;
    }

    setLoading(true);
    Swal.fire({
      title: "Solicitando permiso...",
      text: "Guardando tu solicitud en el sistema",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const fd = new FormData();
    fd.append("intent", "reservar");
    fd.append("tipo", tipoPermiso === "Normal" ? "Normal" : "Especial");
    fd.append(
      "detalles",
      JSON.stringify(
        seleccionados.map((sel) => {
          const [hora_inicio, hora_fin] = sel.horario.split(" - ");
          return {
            id_l: sel.losaId,
            fecha,
            hora_inicio,
            hora_fin,
            duracion: 1,
          };
        }),
      ),
    );
    if (documento) fd.append("documento", documento);

    try {
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok === false) {
        throw new Error(result.error || result.message || "Error al procesar reserva");
      }
      Swal.fire({
        icon: "success",
        title:
          tipoPermiso === "Normal" ? "¡Permiso Confirmado!" : "¡Solicitud Enviada!",
        text:
          tipoPermiso === "Normal"
            ? "Tu reserva fue confirmada inmediatamente."
            : "Tu solicitud especial está pendiente de revisión por el administrador.",
      });
      setSeleccionados([]);
      setDocumento(null);
      await revalidate();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "No se pudo reservar",
        text: (err as Error).message || "Ocurrió un error al registrar la reserva",
      });
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  const losasOrdenadas = [...losas].sort((a, b) =>
    a.numero_l.localeCompare(b.numero_l),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-theme-primary">
          Cuadrícula Interactiva de Horarios
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Consulta la disponibilidad en tiempo real por campo deportivo y bloque de hora.
        </p>
      </div>

      {/* Controles de Reserva */}
      <div className="card-theme p-4 sm:p-6 mb-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-end">
          {/* Tipo de permiso */}
          <Select
            label="Tipo de Permiso *"
            value={tipoPermiso}
            onChange={(e) => handleTipoPermisoChange(e.target.value)}
            className="mb-0"
            options={[
              { value: "Normal", label: "Normal (Reserva Rápida de 1 Bloque)" },
              { value: "Especial", label: "Especial (Múltiples Bloques con PDF)" },
            ]}
          />

          {/* Fecha */}
          <div>
            <label htmlFor="fecha-reserva" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              <FaCalendarAlt className="inline mr-1.5 text-[var(--color-primary-500)]" />
              Fecha de Reserva *
            </label>
            <input
              id="fecha-reserva"
              type="date"
              value={fecha}
              onChange={(e) => handleFechaChange(e.target.value)}
              min={fechaHoy}
              max={tipoPermiso === "Normal" ? fechaHoy : undefined}
              disabled={!tipoPermiso}
              className="min-h-11 w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]/10 focus:border-[var(--color-primary-500)] disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {config && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3.5 text-sm text-[var(--text-secondary)]">
            <FaInfoCircle className="mt-0.5 shrink-0 text-[var(--color-primary-500)]" aria-hidden="true" />
            <p>
              Puedes reservar hasta <strong className="text-[var(--text-primary)]">{config.max_horas_semana} {config.max_horas_semana === 1 ? "hora" : "horas"} por semana</strong>. Restricción para hoy: <strong className="text-[var(--text-primary)]">{config.restriccion_hoy || "sin restricción adicional"}</strong>.
            </p>
          </div>
        )}

        {/* Leyenda y Botón de Acción Especial */}
        {tipoPermiso && (
          <div className="border-t border-[var(--border-color)] pt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-[var(--text-secondary)]">Disponible</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-[var(--text-secondary)]">Ocupado</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                <span className="text-[var(--text-secondary)]">Expirado / Pasado</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[var(--color-primary-500)]"></span>
                <span className="text-[var(--text-secondary)]">Seleccionado</span>
              </span>
            </div>

            {tipoPermiso === "Especial" && seleccionados.length > 0 && (
              <Button
                onClick={() => setShowModal(true)}
                className="min-h-11 w-full shadow-md sm:w-auto"
              >
                Solicitar ({seleccionados.length} {seleccionados.length === 1 ? "bloque seleccionado" : "bloques seleccionados"})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Matriz interactiva */}
      {!config ? (
        <div role="alert" className="card-theme p-6 text-center text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">No se pudo mostrar la cuadrícula de horarios.</p>
          <p className="mt-1">La configuración de atención no está disponible. Intenta nuevamente más tarde.</p>
        </div>
      ) : losasOrdenadas.length === 0 ? (
        <div className="card-theme p-6 text-center text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">No hay losas disponibles para reservar.</p>
          <p className="mt-1">Cuando una losa vuelva a estar disponible, aparecerá en esta sección.</p>
        </div>
      ) : horarios.length === 0 ? (
        <div role="alert" className="card-theme p-6 text-center text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">No hay horarios configurados.</p>
          <p className="mt-1">El rango de atención es inválido o está vacío. Comunícate con el administrador.</p>
        </div>
      ) : errorOcupados ? (
        <div role="alert" className="card-theme p-6 text-center text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">No se pudo consultar la disponibilidad.</p>
          <p className="mt-1">No habilitamos reservas para evitar cruces de horario. Actualiza la página e inténtalo nuevamente.</p>
        </div>
      ) : config && tipoPermiso ? (
        <div className="card-theme overflow-hidden">
          <p id="ayuda-desplazamiento" className="flex items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-secondary)] sm:hidden">
            <FaInfoCircle className="shrink-0 text-[var(--color-primary-500)]" aria-hidden="true" />
            Desliza horizontalmente para consultar todas las losas.
          </p>
          <div className="max-h-[70vh] max-w-full overflow-auto" tabIndex={0} role="region" aria-label="Disponibilidad de horarios por losa" aria-describedby="ayuda-desplazamiento">
            <table className="w-full min-w-max border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
                  <th className="sticky left-0 z-30 min-w-[120px] border-r border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] sm:min-w-[130px] sm:px-5">
                    <FaClock className="inline mr-1.5 text-[var(--color-primary-500)]" />
                    Horario
                  </th>
                  {losasOrdenadas.map((losa) => (
                    <th
                      key={losa.id_l}
                      className="min-w-[140px] border-r border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] last:border-r-0"
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-sm">{losa.nombre}</span>
                        <span className="text-[var(--text-muted)] font-normal text-xs mt-0.5">
                          {getDisciplinaNombre(losa.id_d)} ({losa.numero_l})
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horarios.map((horario, idx) => (
                  <tr
                    key={horario}
                    className={`${idx % 2 === 0 ? "bg-[var(--bg-card)]" : "bg-[var(--bg-surface)]/50"} hover:bg-blue-50/50 transition-colors border-b border-[var(--border-color)] last:border-b-0`}
                  >
                    <td className="sticky left-0 z-10 border-r border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3 text-center text-xs font-semibold text-[var(--text-primary)] sm:px-5">
                      {horario}
                    </td>
                    {losasOrdenadas.map((losa) => {
                      const estado = getEstadoHorario(losa.id_l, horario);
                      const seleccionado = seleccionados.some(
                        (s) =>
                          s.losaId === losa.id_l && s.horario === horario,
                      );
                      const puedeSeleccionar =
                        tipoPermiso &&
                        (tipoPermiso !== "Normal" || fecha === fechaHoy);

                      let estilo = "";
                      let texto = estado;
                      let icono = null;

                      if (estado === "Disponible" && seleccionado) {
                        estilo = "bg-[var(--color-primary-500)] text-white shadow-sm border-[var(--color-primary-600)]";
                        texto = "Seleccionado";
                        icono = <FaCheck className="inline mr-1" />;
                      } else if (estado === "Disponible" && !puedeSeleccionar) {
                        estilo = "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";
                      } else if (estado === "Disponible") {
                        estilo = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer active:scale-95";
                      } else if (estado === "Ocupado") {
                        estilo = "bg-red-50 text-red-600 border-red-200 cursor-not-allowed opacity-80";
                        icono = <FaTimes className="inline mr-1" />;
                      } else if (estado === "Expirado") {
                        estilo = "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";
                      }

                      return (
                        <td
                          key={`${losa.id_l}-${horario}`}
                          className="p-1.5 border-r border-[var(--border-color)] last:border-r-0 text-center"
                        >
                          <button
                            type="button"
                            aria-pressed={seleccionado}
                            aria-label={`Horario ${horario} para ${losa.nombre}: ${estado}`}
                            className={`min-h-11 w-full rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all ${estilo}`}
                            disabled={
                              estado !== "Disponible" ||
                              (tipoPermiso === "Normal" && fecha !== fechaHoy)
                            }
                            onClick={() => toggleEstado(losa.id_l, horario)}
                          >
                            {icono}
                            {texto}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Modal de confirmación */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          if (tipoPermiso === "Normal") setSeleccionados([]);
        }}
        title={
          tipoPermiso === "Normal"
            ? "Confirmar Reserva Inmediata"
            : "Solicitar Permiso Especial"
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] space-y-2.5 text-sm">
            <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
              <span className="text-[var(--text-secondary)]">Fecha de Uso:</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatearFechaCivil(fecha)}
              </span>
            </div>
            <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center">
              <span className="text-[var(--text-secondary)]">Total de bloques:</span>
              <Badge variant="primary">{seleccionados.length} {seleccionados.length === 1 ? "hora" : "horas"}</Badge>
            </div>
            <div className="border-t border-[var(--border-color)] pt-3 mt-2 space-y-1">
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase block">Bloques a reservar:</span>
              {seleccionados.map((s) => (
                <div
                  key={`${s.losaId}-${s.horario}`}
                  className="flex flex-col items-start justify-between gap-1 py-1 text-xs font-medium sm:flex-row sm:gap-3"
                >
                  <span className="min-w-0 break-words text-[var(--text-primary)]">
                    {losasOrdenadas.find((l) => l.id_l === s.losaId)?.nombre || `Losa #${s.losaId}`}
                  </span>
                  <span className="shrink-0 text-[var(--color-primary-600)]">
                    {s.horario}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {tipoPermiso === "Especial" && (
            <div className="space-y-2">
              <label htmlFor="documento-permiso-especial" className="block text-sm font-medium text-[var(--text-primary)]">
                <FaFileUpload className="inline mr-1 text-[var(--color-primary-500)]" />
                Documento de Justificación (PDF) *
              </label>
              <input
                id="documento-permiso-especial"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const archivo = e.target.files?.[0] || null;
                  if (archivo && !esPdfValido(archivo)) {
                    e.target.value = "";
                    setDocumento(null);
                    Swal.fire({
                      icon: "warning",
                      title: "Archivo no válido",
                      text: "Selecciona únicamente un archivo PDF de hasta 10 MB.",
                    });
                    return;
                  }
                  setDocumento(archivo);
                }}
                disabled={loading}
                className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary-50)] file:text-[var(--color-primary-600)] hover:file:bg-[var(--color-primary-100)] cursor-pointer"
              />
              <p className="text-xs text-[var(--text-muted)]">Solo PDF, tamaño máximo de 10 MB.</p>
              {documento && (
                <p className="break-all text-xs font-medium text-emerald-600">
                  ✓ Archivo seleccionado: {documento.name}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              disabled={loading}
              onClick={() => {
                setShowModal(false);
                if (tipoPermiso === "Normal") setSeleccionados([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              onClick={confirmarReserva}
              loading={loading}
              disabled={loading || (tipoPermiso === "Especial" && (!documento || !esPdfValido(documento)))}
            >
              {tipoPermiso === "Normal" ? "Confirmar Reserva" : "Enviar Solicitud"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
