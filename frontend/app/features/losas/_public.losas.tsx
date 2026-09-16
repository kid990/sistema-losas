import { useState, useEffect, useMemo } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import {
  normalizeReservationApiError,
  reservationErrorMessage,
  reservationErrorTitle,
  type ReservationErrorPayload,
} from "~/lib/reservation-errors";
import { Button, Modal, Select, Badge } from "~/shared/components/ui";
import {
  FaMapMarkerAlt,
  FaRulerCombined,
  FaLightbulb,
  FaRunning,
  FaFutbol,
  FaVolleyballBall,
  FaTableTennis,
  FaBasketballBall,
  FaCalendarCheck,
} from "react-icons/fa";

type LosaItem = {
  id_l: number;
  nombre: string;
  numero_l: string;
  id_d?: number;
  estado?: string;
  ubicacion?: string;
};

type LosaDetallada = LosaItem & {
  nombre_disciplina?: string;
  dimensiones?: string;
  superficie?: string;
  iluminacion?: string;
  imagenes?: { id_img: number; nombre_imagen?: string; foto: string }[];
};

type GrupoLosas = {
  disciplina: Record<string, unknown>;
  losas: LosaDetallada[];
};

function iconoDisciplina(nombre?: string) {
  const n = (nombre || "").toLowerCase();
  if (n.includes("futbol") || n.includes("fútbol")) return FaFutbol;
  if (n.includes("voley") || n.includes("vóley") || n.includes("voleibol")) return FaVolleyballBall;
  if (n.includes("tenis")) return FaTableTennis;
  if (n.includes("basquet") || n.includes("basket") || n.includes("baloncesto")) return FaBasketballBall;
  return FaRunning;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario") {
    throw new Response("No autorizado", { status: 403 });
  }

  const [disciplinasData, losasData, configData] = await Promise.all([
    api.get("/disciplinas/activas", request).catch(() => api.get("/disciplinas/", request)),
    api.get("/losas", request),
    api.get("/configuracion", request),
  ]);

  const disciplinasRaw = ((disciplinasData as Record<string, unknown>).data || disciplinasData || []) as Record<string, unknown>[];
  const losasRaw = ((losasData as Record<string, unknown>).data || losasData || []) as LosaItem[];
  const config = configData || null;

  // Solo disciplinas activas (si el endpoint no filtra)
  const disciplinas = disciplinasRaw.filter(
    (d) => !d.estado || d.estado === "Activo"
  );

  // Solo losas disponibles para reserva pública
  const losasDisponibles = losasRaw.filter(
    (l) => !l.estado || l.estado === "Disponible"
  );

  const agrupado: Record<string, LosaItem[]> = {};
  for (const losa of losasDisponibles) {
    const key = String(losa.id_d);
    if (!agrupado[key]) agrupado[key] = [];
    agrupado[key].push({
      id_l: losa.id_l,
      nombre: losa.nombre,
      numero_l: losa.numero_l,
      id_d: losa.id_d,
      estado: losa.estado || "Disponible",
      ubicacion: losa.ubicacion,
    });
  }

  // Filtrar disciplinas sin losas disponibles
  const disciplinasConLosas = disciplinas.filter(
    (d) => (agrupado[String(d.id_d)] || []).length > 0
  );

  // Cargar detalles (imágenes y ficha técnica) de TODAS las losas en paralelo
  const grupos: GrupoLosas[] = await Promise.all(
    disciplinasConLosas.map(async (disciplina) => {
      const losas = await Promise.all(
        (agrupado[String(disciplina.id_d)] || []).map(async (losa) => {
          try {
            const raw = (await api.get(`/losas/losas-detalles/${losa.id_l}`, request)) as Record<string, unknown>;
            const detalles = (raw.data || raw) as LosaDetallada;
            return { ...losa, ...detalles };
          } catch {
            return losa;
          }
        })
      );
      return { disciplina, losas };
    })
  );

  return data(
    {
      grupos,
      config,
      userId: user.id,
    },
    { headers: responseHeadersWithCookies(request) },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario") {
    throw new Response("No autorizado", { status: 403 });
  }

  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "reservar") {
    try {
      const detalles = JSON.parse(fd.get("detalles") as string);
      await api.post("/permisos", request, {
        tipo: "Normal",
        id_u: user.id,
        duracion_t: 1,
        detalles,
      });
      return data({ ok: true }, { headers: responseHeadersWithCookies(request) });
    } catch (err) {
      if (err instanceof Response) throw err;
      const normalized = normalizeReservationApiError(err, "No se pudo registrar la reserva");
      return data(
        {
          ok: false,
          error: normalized.payload.message,
          code: normalized.payload.code,
          details: normalized.payload.details,
          conflicts: normalized.payload.conflicts,
        },
        { status: normalized.status, headers: responseHeadersWithCookies(request) },
      );
    }
  }

  return data({ ok: false, error: "Acción no válida" }, { status: 400 });
}

function getImageSrc(foto: string) {
  if (!foto) return "";
  if (foto.startsWith("data:image") || foto.startsWith("blob:") || foto.startsWith("http")) return foto;
  if (/^[A-Za-z0-9+/=]+$/.test(foto)) return `data:image/jpeg;base64,${foto}`;
  return foto;
}

function GaleriaLosa({ losa }: { losa: LosaDetallada }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const images = losa.imagenes || [];
  const rawFoto = images[selectedImageIndex]?.foto || images[0]?.foto || "";
  const fotoPrincipal = getImageSrc(rawFoto);

  if (images.length === 0) {
    return (
      <div className="aspect-4/3 flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--bg-surface)] p-6 text-center rounded-2xl border border-[var(--border-color)]">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium">Sin fotografías registradas</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-slate-900 shadow-sm">
      <div className="relative aspect-4/3 w-full bg-slate-100">
        <img
          src={fotoPrincipal}
          alt={`Fotografía de ${losa.nombre}`}
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover transition-opacity duration-200"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=Sin+imagen"; }}
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto bg-white border-t border-[var(--border-color)]">
          {images.map((img, i) => (
            <button
              key={img.id_img ?? i}
              type="button"
              onClick={() => setSelectedImageIndex(i)}
              aria-label={`Ver foto ${i + 1} de la losa`}
              className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                selectedImageIndex === i ? "border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/20 scale-105" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={getImageSrc(img.foto as string)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LosaCard({ losa, onSolicitar }: { losa: LosaDetallada; onSolicitar: (losa: LosaDetallada) => void }) {
  const disponible = !losa.estado || losa.estado === "Disponible";

  return (
    <article className="card-theme overflow-hidden hover-lift border border-slate-200/80 shadow-md">
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-12 gap-6 items-start p-5 sm:p-7">
        {/* Galería de imágenes (5 cols) */}
        <div className="lg:col-span-5 min-w-0">
          <GaleriaLosa losa={losa} />
        </div>

        {/* Información y Ficha Técnica (7 cols) */}
        <div className="lg:col-span-7 min-w-0 flex flex-col justify-between h-full space-y-5">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#1B6EB6] border border-blue-200/60 mb-1.5">
                  Campo {losa.numero_l || `#${losa.id_l}`}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight break-words">
                  {losa.nombre}
                </h3>
              </div>
              <Badge variant="success" dot>Disponible</Badge>
            </div>

            {/* Ficha técnica en cuadrícula 2x2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-[#1B6EB6] flex items-center justify-center shrink-0 text-xs">
                  <FaMapMarkerAlt />
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Ubicación</span>
                  <span className="text-xs font-semibold text-slate-700 block truncate">{losa.ubicacion || "Complejo UNHEVAL"}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs">
                  <FaRulerCombined />
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Dimensiones</span>
                  <span className="text-xs font-semibold text-slate-700 block truncate">{losa.dimensiones || "Reglamentaria"}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs">
                  <FaRunning />
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Superficie</span>
                  <span className="text-xs font-semibold text-slate-700 block truncate">{losa.superficie || "Sintético / Cemento"}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xs">
                  <FaLightbulb />
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Iluminación</span>
                  <span className="text-xs font-semibold text-slate-700 block truncate">{losa.iluminacion || "Reflectores LED"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              ⚡ Reserva inmediata para el día de hoy
            </span>
            <button
              type="button"
              onClick={() => onSolicitar(losa)}
              disabled={!disponible}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#1B6EB6] to-[#165b9a] shadow-md shadow-blue-500/20 hover:scale-[1.02] hover:shadow-lg active:scale-95 disabled:opacity-50 transition-all ml-auto w-full sm:w-auto"
            >
              <FaCalendarCheck size={13} /> Solicitar Permiso
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function LosasUser() {
  const { grupos, config, userId } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const gruposTyped = (grupos as GrupoLosas[]) || [];
  const [selectedDiscId, setSelectedDiscId] = useState<number | null>(null);
  const [modalLosa, setModalLosa] = useState<LosaDetallada | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedHorario, setSelectedHorario] = useState("");
  const [loadingReserva, setLoadingReserva] = useState(false);

  const fechaHoy = useMemo(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  }, []);

  // Grupo activo: el seleccionado en el menú, o el primero por defecto
  const grupoActivo = useMemo(() => {
    if (gruposTyped.length === 0) return null;
    return (
      gruposTyped.find((g) => String(g.disciplina.id_d) === String(selectedDiscId)) ||
      gruposTyped[0]
    );
  }, [gruposTyped, selectedDiscId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showModal && !loadingReserva) setShowModal(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showModal, loadingReserva]);

  const horarios = useMemo(() => {
    if (!config) return [];
    const c = config as Record<string, unknown>;
    const horaMin = parseInt(c.hora_min_apertura as string, 10);
    const horaMax = parseInt(c.hora_max_apertura as string, 10);
    if (Number.isNaN(horaMin) || Number.isNaN(horaMax) || horaMax <= horaMin) return [];
    return Array.from({ length: horaMax - horaMin }, (_, i) => {
      const h = i + horaMin;
      return {
        label: `${String(h).padStart(2, "0")}:00 - ${String(h + 1).padStart(2, "0")}:00`,
        value: `${h}-${h + 1}`,
        inicio: h,
        fin: h + 1,
      };
    });
  }, [config]);

  const abrirModal = (losa: LosaDetallada) => {
    if (!userId) {
      Swal.fire({ icon: "warning", title: "Debe iniciar sesión", text: "Inicie sesión con su código universitario." });
      return;
    }
    if (losa.estado && losa.estado !== "Disponible") {
      Swal.fire({ icon: "info", title: "Losa no disponible", text: "Esta losa se encuentra en mantenimiento o no disponible." });
      return;
    }
    const horaActual = new Date().getHours();
    const disponibles = horarios.filter((h) => h.inicio > horaActual);
    if (disponibles.length === 0) {
      Swal.fire({ icon: "info", title: "Horarios agotados", text: "No quedan horarios disponibles para reservar el día de hoy." });
      return;
    }
    setModalLosa(losa);
    setSelectedHorario("");
    setShowModal(true);
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHorario || !modalLosa || !userId) return;
    setLoadingReserva(true);

    const [horaInicio, horaFin] = selectedHorario.split("-").map(Number);
    const detalles = [
      {
        id_l: modalLosa.id_l,
        fecha: fechaHoy,
        hora_inicio: `${String(horaInicio).padStart(2, "0")}:00:00`,
        hora_fin: `${String(horaFin).padStart(2, "0")}:00:00`,
        duracion: 1,
      },
    ];
    const fd = new FormData();
    fd.append("intent", "reservar");
    fd.append("tipo", "Normal");
    fd.append("detalles", JSON.stringify(detalles));

    try {
      const res = await fetch("/api/reservas", { method: "post", body: fd });
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
        title: "Reserva confirmada",
        text: `Tu permiso para ${modalLosa.nombre || "la losa"} fue generado exitosamente.`,
        timer: 2500,
        showConfirmButton: true,
      });
      setShowModal(false);
      setModalLosa(null);
      revalidator.revalidate();
    } catch (err) {
      const reservationError = err as Error & { code?: string };
      setShowModal(false);
      void Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: reservationErrorTitle(reservationError.code),
        text: reservationError.message || "Ocurrió un error al registrar la reserva",
        showConfirmButton: false,
        showCloseButton: true,
      });
    } finally {
      setLoadingReserva(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-200 text-xl font-bold">
            🏟️
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Explorar Losas Deportivas
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Selecciona una disciplina para ver sus campos, consultar la ficha técnica y reservar
            </p>
          </div>
        </div>
      </div>

      {/* Menú de disciplinas */}
      <div className="card-theme p-5 min-w-0">
        <div className="flex items-center gap-2 mb-3.5">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Disciplinas Disponibles:
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="Disciplinas deportivas">
          {gruposTyped.map(({ disciplina, losas }) => {
            const isSelected = String(disciplina.id_d) === String(grupoActivo?.disciplina.id_d);
            const Icono = iconoDisciplina(disciplina.nombre as string);

            return (
              <button
                key={String(disciplina.id_d)}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Ver losas de ${disciplina.nombre as string}`}
                onClick={() => setSelectedDiscId(disciplina.id_d as number)}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 ${
                  isSelected
                    ? "bg-gradient-to-r from-[#1B6EB6] to-[#165b9a] text-white shadow-md shadow-blue-500/25"
                    : "bg-slate-50 border border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                }`}
              >
                <Icono className={`text-sm ${isSelected ? "text-white" : "text-[#1B6EB6]"}`} aria-hidden="true" />
                <span>{disciplina.nombre as string}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    isSelected
                      ? "bg-white/25 text-white"
                      : "bg-blue-100/70 text-[#1B6EB6]"
                  }`}
                >
                  {losas.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {gruposTyped.length === 0 && (
        <div className="card-theme p-12 text-center text-slate-400">
          <FaFutbol className="text-4xl mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-600">No hay losas disponibles para reserva en este momento.</p>
        </div>
      )}

      {/* Todas las losas de la disciplina seleccionada */}
      {grupoActivo && (
        <section aria-labelledby="grupo-activo" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-200 text-base font-bold">
              {(() => {
                const Icono = iconoDisciplina(grupoActivo.disciplina.nombre as string);
                return <Icono aria-hidden="true" />;
              })()}
            </span>
            <div>
              <h2 id="grupo-activo" className="text-lg font-bold text-slate-800 tracking-tight">
                Losas de {grupoActivo.disciplina.nombre as string}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {grupoActivo.losas.length} {grupoActivo.losas.length === 1 ? "campo deportivo disponible" : "campos deportivos disponibles"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {grupoActivo.losas.map((losa) => (
              <LosaCard key={losa.id_l} losa={losa} onSolicitar={abrirModal} />
            ))}
          </div>
        </section>
      )}

      {/* Modal de Solicitud Rápida */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Solicitar Permiso de Uso Hoy"
        size="md"
      >
        <form onSubmit={handleConfirmar} className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Losa deportiva:</span>
              <span className="font-bold text-slate-800">{modalLosa?.nombre} ({modalLosa?.numero_l})</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Disciplina:</span>
              <span className="font-bold text-[#1B6EB6]">{modalLosa?.nombre_disciplina || "Deporte"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Fecha de Reserva:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">Hoy ({fechaHoy})</span>
            </div>
          </div>

          <Select
            label="Horario disponible para hoy *"
            value={selectedHorario}
            onChange={(e) => setSelectedHorario(e.target.value)}
            placeholder="Selecciona un bloque de hora"
            required
            options={horarios
              .filter((h) => h.inicio > new Date().getHours())
              .map((h) => ({
                value: h.value,
                label: `${h.label} (1 hora)`,
              }))}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              disabled={loadingReserva}
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loadingReserva}
              disabled={!selectedHorario}
            >
              Confirmar Reserva
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
