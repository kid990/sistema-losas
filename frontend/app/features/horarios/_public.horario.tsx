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
import { FaCheck, FaTimes, FaCalendarAlt, FaFileUpload } from "react-icons/fa";

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

  const config = (configData || DEFAULT_CONFIG) as Config;

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
    <div className="space-y-4 max-w-6xl">
      {/* Encabezado directo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Horarios de Atención
          </h1>
          <p className="text-xs text-slate-500">
            Selecciona el horario disponible para reservar
          </p>
        </div>
      </div>

      {/* Controles simples */}
      <div className="card-theme p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
          {/* Tipo de permiso */}
          <div className="md:col-span-6 flex gap-2">
            <button
              type="button"
              onClick={() => handleTipoPermisoChange("Normal")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                tipoPermiso === "Normal"
                  ? "bg-[#1B6EB6] text-white border-[#1B6EB6]"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Reserva Normal
            </button>
            <button
              type="button"
              onClick={() => handleTipoPermisoChange("Especial")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                tipoPermiso === "Especial"
                  ? "bg-[#1B6EB6] text-white border-[#1B6EB6]"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Permiso Especial
            </button>
          </div>

          {/* Fecha */}
          <div className="md:col-span-3">
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
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-none focus:border-[#1B6EB6] disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>

          {/* Botón solicitar para Especial */}
          <div className="md:col-span-3 flex justify-end">
            {tipoPermiso === "Especial" && seleccionados.length > 0 && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="w-full sm:w-auto px-4 py-1.5 rounded-lg font-bold text-xs text-white bg-[#1B6EB6] hover:bg-[#145792] transition-colors"
              >
                Solicitar ({seleccionados.length})
              </button>
            )}
          </div>
        </div>

        {/* Leyenda simple */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Disponible
          </span>
          <span className="flex items-center gap-1.5 text-rose-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Ocupado
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
            No disponible
          </span>
          <span className="flex items-center gap-1.5 text-[#1B6EB6] font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1B6EB6]"></span>
            Seleccionado
          </span>
        </div>
      </div>

      {/* Grilla de horarios limpia */}
      <div className="card-theme overflow-hidden">
        <div className="max-h-[68vh] max-w-full overflow-auto">
          <table className="w-full min-w-max border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-30 min-w-[120px] border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-left text-xs font-bold text-slate-700">
                  Horario
                </th>
                {losasOrdenadas.map((losa) => (
                  <th
                    key={losa.id_l}
                    className="min-w-[130px] border-r border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-700 last:border-r-0"
                  >
                    <div>{losa.nombre}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {getDisciplinaNombre(losa.id_d)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horarios.map((horario, idx) => (
                <tr
                  key={horario}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-blue-50/30 border-b border-slate-100 last:border-b-0`}
                >
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-xs font-mono font-medium text-slate-600">
                    {horario}
                  </td>
                  {losasOrdenadas.map((losa) => {
                    const estado = getEstadoHorario(losa.id_l, horario);
                    const seleccionado = seleccionados.some(
                      (s) => s.losaId === losa.id_l && s.horario === horario
                    );

                    let estilo = "";
                    let texto = estado;
                    let icono = null;

                    if (estado === "Disponible" && seleccionado) {
                      estilo = "bg-[#1B6EB6] text-white font-bold";
                      texto = "Seleccionado";
                      icono = <FaCheck className="inline mr-1 text-[10px]" />;
                    } else if (estado === "Disponible") {
                      estilo = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer";
                    } else if (estado === "Ocupado") {
                      estilo = "bg-rose-50 text-rose-600 border-rose-100 cursor-not-allowed text-[11px]";
                      icono = <FaTimes className="inline mr-1 text-[10px]" />;
                    } else {
                      estilo = "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed text-[11px]";
                    }

                    return (
                      <td
                        key={`${losa.id_l}-${horario}`}
                        className="p-1 border-r border-slate-100 last:border-r-0 text-center"
                      >
                        <button
                          type="button"
                          className={`min-h-8 w-full rounded-md border px-2 py-1 text-xs transition-colors ${estilo}`}
                          disabled={estado !== "Disponible"}
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
