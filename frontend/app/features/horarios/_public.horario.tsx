import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator, data, redirect } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import Swal from "sweetalert2";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { ROLES } from "~/shared/types/roles";
import {
  normalizeReservationApiError,
  reservationErrorMessage,
  reservationErrorTitle,
  type ReservationErrorPayload,
} from "~/lib/reservation-errors";
import { Button, Modal } from "~/shared/components/ui";
import {
  FaCalendarAlt,
  FaFileUpload,
  FaCalendarCheck,
  FaInfoCircle,
  FaShieldAlt,
  FaFutbol,
  FaLayerGroup,
} from "react-icons/fa";

interface Ocupado {
  id_l: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: "Normal" | "Especial";
  estado: "Pendiente" | "Aceptado";
}

interface Losa {
  id_l: number;
  nombre: string;
  numero_l: string;
  id_d: number;
  estado?: string;
}

interface Disciplina {
  id_d: number;
  nombre: string;
  estado?: string;
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

const DEFAULT_CONFIG: Config = {
  hora_min_apertura: "06:00:00",
  hora_max_apertura: "22:00:00",
  restriccion_hoy: "08:00:00",
  max_horas_semana: 4,
};

const MAX_PDF_SIZE = 10 * 1024 * 1024;

const ICONOS_ESTADO: Record<string, string> = {
  Libre: "M4 10.5 8 14.5 16 6",
  Elegido: "M4 10.5 8 14.5 16 6",
  Ocupado: "M5 5h10v10H5z",
  "En revisión": "M6 3.5h8M6 16.5h8M7 3.5c0 3.5 6 3.5 6 6.5s-6 3-6 6.5M13 3.5c0 3.5-6 3.5-6 6.5s6 3 6 6.5",
  Pasado: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM10 6v4l2.5 2",
};

function IconoEstado({ estado }: { estado: string }) {
  return (
    <svg
      className="size-4 shrink-0 stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICONOS_ESTADO[estado] ?? ICONOS_ESTADO.Libre} className={estado === "Ocupado" ? "fill-current" : "fill-none"} />
    </svg>
  );
}

const esPdfValido = (archivo: File) =>
  archivo.type === "application/pdf" &&
  archivo.name.toLowerCase().endsWith(".pdf") &&
  archivo.size > 0 &&
  archivo.size <= MAX_PDF_SIZE;

const fechaCivil = (valor: string) => valor.slice(0, 10);

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  if (user.tipo !== ROLES.USUARIO.tipo) {
    if (user.tipo === ROLES.ADMIN.tipo && user.rol === ROLES.ADMIN.rol) {
      throw redirect("/dashboard/inicio");
    }
    if (user.tipo === ROLES.SEGURIDAD.tipo && user.rol === ROLES.SEGURIDAD.rol) {
      throw redirect("/seguridad/modulo");
    }
    throw redirect("/login");
  }

  const [losasData, disciplinasData, configData, ocupadosData] =
    await Promise.all([
      api.get("/losas", request).catch(() => ({ data: [] })),
      api
        .get("/disciplinas/activas", request)
        .catch(() => api.get("/disciplinas/", request).catch(() => ({ data: [] }))),
      api.get("/configuracion", request).catch(() => null),
      api
        .get("/permisos/bloqueados-detalle", request)
        .catch(() => ({ data: [], errorCarga: false })),
    ]);

  const losasAll = (((losasData as Record<string, unknown>)?.data ||
    losasData ||
    []) as Losa[]);

  const losas = Array.isArray(losasAll)
    ? losasAll.filter((l) => !l.estado || l.estado === "Disponible")
    : [];

  const disciplinasRaw = (((disciplinasData as Record<string, unknown>)?.data ||
    disciplinasData ||
    []) as Disciplina[]);

  const disciplinas = Array.isArray(disciplinasRaw)
    ? disciplinasRaw.filter((d) => !d.estado || d.estado === "Activo")
    : [];

  const config = (((configData as Record<string, unknown> | null)?.data ||
    configData ||
    DEFAULT_CONFIG) as Config);

  const ocupados = (((ocupadosData as Record<string, unknown>)?.data ||
    ocupadosData ||
    []) as Ocupado[]);

  return data(
    {
      user,
      losas,
      disciplinas,
      config,
      ocupados: Array.isArray(ocupados) ? ocupados : [],
    },
    { headers: responseHeadersWithCookies(request) }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== ROLES.USUARIO.tipo) {
    throw new Response("No autorizado", { status: 403 });
  }

  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "reservar") {
    try {
      const tipo = fd.get("tipo") as string;
      const detalles = JSON.parse(fd.get("detalles") as string);
      const documento = fd.get("documento") as File | null;

      if (tipo === "Especial" && (!documento || !esPdfValido(documento))) {
        return data(
          { ok: false, error: "Adjunta un documento PDF válido (máx. 10 MB)." },
          { status: 400, headers: responseHeadersWithCookies(request) }
        );
      }

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
      if (err instanceof Response) throw err;
      const normalized = normalizeReservationApiError(err, "No se pudo realizar la reserva");
      return data(
        {
          ok: false,
          error: normalized.payload.message,
          code: normalized.payload.code,
          details: normalized.payload.details,
          conflicts: normalized.payload.conflicts,
        },
        { status: normalized.status, headers: responseHeadersWithCookies(request) }
      );
    }
  }

  return data({ ok: false, error: "Operación no válida" }, { status: 400 });
}

export default function HorarioPublic() {
  const { losas, disciplinas, config, ocupados } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const fechaHoy = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  }, []);

  const [tipoPermiso, setTipoPermiso] = useState<"Normal" | "Especial">("Normal");
  const [fecha, setFecha] = useState(fechaHoy);
  const [seleccionados, setSeleccionados] = useState<Seleccion[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [documento, setDocumento] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const getDisciplinaNombre = (id_d: number) =>
    disciplinas.find((x) => x.id_d === id_d)?.nombre || "";

  const getEstadoHorario = (losaId: number, horario: string) => {
    const [horaInicio] = horario.split(" - ");
    const ocupado = ocupados.find(
      (o) =>
        o.id_l === losaId &&
        fechaCivil(o.fecha) === fecha &&
        o.hora_inicio.substring(0, 5) === horaInicio
    );
    if (ocupado?.tipo === "Especial" && ocupado.estado === "Pendiente") {
      return "Pendiente";
    }
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
    const conf = config || DEFAULT_CONFIG;
    let horaMin = Number(conf.hora_min_apertura?.split(":")[0]);
    let horaMax = Number(conf.hora_max_apertura?.split(":")[0]);

    if (
      !Number.isInteger(horaMin) ||
      !Number.isInteger(horaMax) ||
      horaMin < 0 ||
      horaMin > 23 ||
      horaMax < 1 ||
      horaMax > 24 ||
      horaMax <= horaMin
    ) {
      horaMin = 6;
      horaMax = 22;
    }

    return Array.from({ length: horaMax - horaMin }, (_, i) => {
      const h = i + horaMin;
      return `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`;
    });
  }, [config]);

  const handleTipoPermisoChange = (tipo: "Normal" | "Especial") => {
    setTipoPermiso(tipo);
    if (tipo === "Normal") setFecha(fechaHoy);
    setSeleccionados([]);
  };

  const toggleEstado = (losaId: number, horario: string) => {
    const estado = getEstadoHorario(losaId, horario);
    if (estado !== "Disponible") return;

    if (tipoPermiso === "Normal") {
      setSeleccionados([{ losaId, horario }]);
      setShowModal(true);
    } else {
      const yaSel = seleccionados.some(
        (s) => s.losaId === losaId && s.horario === horario
      );
      setSeleccionados((prev) =>
        yaSel
          ? prev.filter((s) => !(s.losaId === losaId && s.horario === horario))
          : [...prev, { losaId, horario }]
      );
    }
  };

  const confirmarReserva = async () => {
    if (tipoPermiso === "Especial" && (!documento || !esPdfValido(documento))) {
      Swal.fire({
        icon: "warning",
        title: "PDF requerido",
        text: "Adjunta el archivo PDF de justificación (máx. 10 MB).",
      });
      return;
    }

    setLoading(true);

    const fd = new FormData();
    fd.append("intent", "reservar");
    fd.append("tipo", tipoPermiso);
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
        })
      )
    );
    if (documento) fd.append("documento", documento);

    try {
      const res = await fetch("/api/reservas", { method: "POST", body: fd });
      const result = (await res.json().catch(() => ({}))) as ReservationErrorPayload & {
        ok?: boolean;
      };

      if (!res.ok || result.ok === false) {
        const error = new Error(reservationErrorMessage(result)) as Error & { code?: string };
        error.code = result.code;
        throw error;
      }

      Swal.fire({
        icon: "success",
        title: tipoPermiso === "Normal" ? "Reserva Exitosa" : "Solicitud Enviada",
        text:
          tipoPermiso === "Normal"
            ? "Tu reserva quedó confirmada."
            : "Tu solicitud está en revisión.",
      });

      setSeleccionados([]);
      setDocumento(null);
      await revalidate();
    } catch (err) {
      const reservationError = err as Error & { code?: string };
      void Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: reservationErrorTitle(reservationError.code),
        text: reservationError.message || "Error al registrar la reserva.",
        showConfirmButton: false,
        showCloseButton: true,
      });
    } finally {
      setLoading(false);
      setShowModal(false);
    }
  };

  const losasOrdenadas = [...losas].sort((a, b) =>
    (a.numero_l || "").localeCompare(b.numero_l || "")
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* ─── Encabezado Principal ───────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-[#1B6EB6] text-[11px] font-semibold tracking-wide">
            <FaCalendarCheck size={12} />
            <span>Sistema Inteligente de Reserva</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-slab">
            Horarios y Disponibilidad
          </h1>
          <p className="text-xs text-slate-500">
            Explora las losas deportivas en tiempo real y reserva tu turno al instante.
          </p>
        </div>

        {/* Resumen dinámico de selección para Permiso Especial */}
        {tipoPermiso === "Especial" && seleccionados.length > 0 && (
          <div className="flex items-center gap-3 bg-linear-to-r from-blue-500 to-indigo-600 p-2.5 px-4 rounded-xl text-white shadow-md">
            <div>
              <p className="text-[11px] text-blue-100 font-medium">Bloques marcados</p>
              <p className="text-base font-black leading-none">{seleccionados.length} {seleccionados.length === 1 ? "hora" : "horas"}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-white text-[#1B6EB6] font-bold text-xs hover:bg-blue-50 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              Continuar solicitud →
            </button>
          </div>
        )}
      </div>

      {/* ─── Panel de Configuración de Filtros ──────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Selector de Modalidad */}
          <div className="md:col-span-6">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Tipo de Reserva
            </label>
            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => handleTipoPermisoChange("Normal")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoPermiso === "Normal"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FaFutbol className={tipoPermiso === "Normal" ? "text-[#1B6EB6]" : "text-slate-400"} />
                <span>Reserva Normal</span>
              </button>
              <button
                type="button"
                onClick={() => handleTipoPermisoChange("Especial")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tipoPermiso === "Especial"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FaShieldAlt className={tipoPermiso === "Especial" ? "text-indigo-600" : "text-slate-400"} />
                <span>Permiso Especial</span>
              </button>
            </div>
          </div>

          {/* Selector de Fecha */}
          <div className="md:col-span-6">
            <label htmlFor="fecha-reserva" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Fecha de Reserva {tipoPermiso === "Normal" && <span className="text-slate-400 font-normal lowercase">(solo día de hoy)</span>}
            </label>
            <div className="relative">
              <input
                id="fecha-reserva"
                type="date"
                value={fecha}
                onChange={(e) => {
                  if (tipoPermiso === "Especial" && e.target.value >= fechaHoy) {
                    setFecha(e.target.value);
                    setSeleccionados([]);
                  }
                }}
                min={fechaHoy}
                disabled={tipoPermiso === "Normal"}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200/90 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1B6EB6] focus:ring-2 focus:ring-[#1B6EB6]/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
              />
              <FaCalendarAlt className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs" />
            </div>
          </div>
        </div>

        {/* ─── Leyenda Moderna con diseño pill ───────────────────── */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Estados:
            </span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-slate-900 border border-emerald-300 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Disponible</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-slate-900 border border-rose-200 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Ocupado</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-slate-900 border border-amber-300 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>En Revisión</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-900 border border-slate-300 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Pasado</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1B6EB6] border border-blue-200 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[#1B6EB6]" />
              <span>Seleccionado</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <FaInfoCircle className="text-slate-400" />
            <span>Haz clic en un bloque verde para reservar</span>
          </div>
        </div>
      </div>

      {/* ─── Tabla / Grilla de Horarios ──────────────────────── */}
      <div className="relative overflow-x-auto overscroll-x-contain rounded-xl border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm">
        <table className="w-full min-w-max border-separate border-spacing-1 p-1 text-left">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-[1] w-16 bg-[var(--ui-surface)] px-2 pb-2 text-left align-bottom text-[11px] font-bold uppercase tracking-widest text-[var(--ui-muted)] sm:w-20"
              >
                Hora
              </th>
              {losasOrdenadas.map((losa) => (
                <th key={losa.id_l} scope="col" className="min-w-[84px] px-0 pt-1 pb-2 text-center align-bottom">
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-[var(--ui-muted)]">
                    Losa
                  </span>
                  <span
                    className="mt-1 inline-grid size-11 place-items-center rounded-md bg-[#1757b8] font-slab text-[26px] leading-none font-bold text-white shadow-[inset_0_0_0_3px_#1757b8,inset_0_0_0_5px_rgb(255_255_255/0.75)]"
                    title={`${losa.nombre}${getDisciplinaNombre(losa.id_d) ? ` · ${getDisciplinaNombre(losa.id_d)}` : ""}`}
                  >
                    {losa.numero_l || losa.id_l}
                  </span>
                  <span className="sr-only">{losa.nombre}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {horarios.map((horario) => {
              const [horaInicio, horaFin] = horario.split(" - ");
              return (
                <tr key={horario}>
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] w-16 bg-[var(--ui-surface)] px-2 text-left font-slab leading-none tabular-nums sm:w-20"
                  >
                    <span className="block text-lg font-semibold text-[var(--ui-ink)]">{horaInicio}</span>
                    <span className="block text-sm font-normal text-[var(--ui-muted)]">
                      <span className="sr-only">a </span>
                      {horaFin}
                    </span>
                  </th>

                  {losasOrdenadas.map((losa) => {
                    const estado = getEstadoHorario(losa.id_l, horario);
                    const seleccionado = seleccionados.some(
                      (s) => s.losaId === losa.id_l && s.horario === horario
                    );

                    let celdaClase = "";
                    let etiqueta = "";

                    if (estado === "Disponible") {
                      etiqueta = seleccionado ? "Elegido" : "Libre";
                      celdaClase = seleccionado
                        ? "border border-emerald-700 bg-emerald-600 font-bold text-white shadow-[inset_0_0_0_2px_rgb(255_255_255/0.9)]"
                        : "border border-emerald-600 bg-emerald-100 font-semibold text-emerald-900 hover:shadow-[inset_0_0_0_2px_#059669]";
                    } else if (estado === "Ocupado") {
                      etiqueta = "Ocupado";
                      celdaClase = "border border-rose-600 bg-rose-100 font-semibold text-rose-900";
                    } else if (estado === "Pendiente") {
                      etiqueta = "En revisión";
                      celdaClase = "border-2 border-dashed border-amber-600 bg-amber-100 font-semibold text-amber-900";
                    } else {
                      etiqueta = "Pasado";
                      celdaClase = "border border-dotted border-slate-300 font-medium text-slate-500";
                    }

                    const contenido = (
                      <>
                        <IconoEstado estado={etiqueta} />
                        <span className="[overflow-wrap:anywhere]">{etiqueta}</span>
                      </>
                    );

                    return (
                      <td key={`${losa.id_l}-${horario}`} className="p-0">
                        {estado === "Disponible" ? (
                          <button
                            type="button"
                            aria-pressed={seleccionado}
                            className={`flex min-h-13 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md p-1 text-center text-xs leading-tight transition sm:text-[0.8125rem] ${celdaClase}`}
                            onClick={() => toggleEstado(losa.id_l, horario)}
                          >
                            {contenido}
                          </button>
                        ) : (
                          <span
                            className={`flex min-h-13 w-full flex-col items-center justify-center gap-0.5 rounded-md p-1 text-center text-xs leading-tight sm:text-[0.8125rem] ${celdaClase}`}
                          >
                            {contenido}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de confirmación simple */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          if (tipoPermiso === "Normal") setSeleccionados([]);
        }}
        title={tipoPermiso === "Normal" ? "Confirmar Reserva" : "Permiso Especial"}
        size="md"
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha:</span>
              <span className="font-bold text-slate-800">{fecha}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bloques:</span>
              <span className="font-bold text-[#1B6EB6]">{seleccionados.length}</span>
            </div>
            <div className="pt-1 border-t border-slate-200">
              {seleccionados.map((s) => (
                <div key={`${s.losaId}-${s.horario}`} className="flex justify-between py-0.5">
                  <span>{losasOrdenadas.find((l) => l.id_l === s.losaId)?.nombre}</span>
                  <span className="font-mono text-slate-600">{s.horario}</span>
                </div>
              ))}
            </div>
          </div>

          {tipoPermiso === "Especial" && (
            <div className="space-y-1">
              <label htmlFor="modal-documento" className="block font-bold text-slate-700">
                Documento PDF *
              </label>
              <input
                id="modal-documento"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const archivo = e.target.files?.[0] || null;
                  if (archivo && !esPdfValido(archivo)) {
                    e.target.value = "";
                    setDocumento(null);
                    Swal.fire({
                      icon: "warning",
                      title: "Archivo inválido",
                      text: "Solo PDF hasta 10 MB.",
                    });
                    return;
                  }
                  setDocumento(archivo);
                }}
                disabled={loading}
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
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
              loading={loading}
              disabled={loading || (tipoPermiso === "Especial" && !documento)}
              onClick={confirmarReserva}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
