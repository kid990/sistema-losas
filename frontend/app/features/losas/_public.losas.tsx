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

function GaleriaLosa({ losa }: { losa: LosaDetallada }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const images = losa.imagenes || [];
  const fotoPrincipal = images[selectedImageIndex]?.foto || images[0]?.foto || "";

  if (images.length === 0) {
    return (
      <div className="aspect-4/3 flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--bg-surface)] p-6 text-center">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium">No hay fotos disponibles para esta losa.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="relative aspect-4/3 w-full">
        <img
          src={fotoPrincipal}
          alt={`Fotografía de ${losa.nombre}`}
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x600?text=Sin+imagen"; }}
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto border-t border-[var(--border-color)]">
          {images.map((img, i) => (
            <button
              key={img.id_img ?? i}
              type="button"
              onClick={() => setSelectedImageIndex(i)}
              aria-label={`Ver foto ${i + 1} de la losa`}
              className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                selectedImageIndex === i ? "border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/20" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={img.foto as string} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
    <article className="card-theme overflow-hidden">
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 items-start p-4 sm:p-6 lg:p-8">
        <GaleriaLosa losa={losa} />

        <div className="min-w-0 space-y-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] break-words">
                {losa.nombre}
              </h3>
              <p className="text-sm font-medium text-[var(--text-secondary)] mt-0.5">
                Número de campo: <span className="font-semibold text-[var(--text-primary)] break-words">{losa.numero_l}</span>
              </p>
            </div>
            <Badge variant="success" dot>Disponible</Badge>
          </div>

          <Button
            onClick={() => onSolicitar(losa)}
            disabled={!disponible}
            className="w-fit"
          >
            Solicitar permiso
          </Button>

          <div className="space-y-3.5 border-t border-[var(--border-color)] pt-6 text-sm">
            <div className="flex items-start gap-3">
              <FaMapMarkerAlt className="text-[var(--color-primary-500)] mt-1 shrink-0" />
              <div>
                 <span className="text-xs font-semibold text-[var(--text-muted)] block">Ubicación</span>
                 <span className="text-[var(--text-primary)] font-medium break-words">{losa.ubicacion || "No informado"}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaRulerCombined className="text-[var(--color-primary-500)] mt-1 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-[var(--text-muted)] block">Dimensiones</span>
                <span className="text-[var(--text-primary)] font-medium break-words">{losa.dimensiones || "No informado"}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaRunning className="text-[var(--color-primary-500)] mt-1 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-[var(--text-muted)] block">Superficie</span>
                <span className="text-[var(--text-primary)] font-medium break-words">{losa.superficie || "No informado"}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FaLightbulb className="text-[var(--color-primary-500)] mt-1 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-[var(--text-muted)] block">Iluminación</span>
                <span className="text-[var(--text-primary)] font-medium break-words">{losa.iluminacion || "No informado"}</span>
              </div>
            </div>
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
    <div className="min-w-0">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-theme-primary break-words">Explorar losas deportivas</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Selecciona una disciplina para ver todas sus losas, consultar la ficha técnica y solicitar tu reserva para hoy.
        </p>
      </div>

      {/* Menú de disciplinas */}
      <div className="card-theme p-3 sm:p-5 mb-5 sm:mb-8 min-w-0">
        <p className="text-xs font-semibold text-[var(--text-muted)] mb-3">
          Disciplinas disponibles:
        </p>
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
                className={`inline-flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isSelected
                    ? "bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-white shadow-md shadow-[var(--color-primary-500)]/20"
                    : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--color-primary-500)]"
                }`}
              >
                <Icono className={isSelected ? "text-white" : "text-[var(--color-primary-500)]"} aria-hidden="true" />
                <span className="min-w-0 break-words">{disciplina.nombre as string}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-primary-50)] text-[var(--color-primary-600)]"
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
        <div className="card-theme p-6 sm:p-12 text-center text-[var(--text-secondary)]">
          No hay losas disponibles para reserva en este momento.
        </div>
      )}

      {/* Todas las losas de la disciplina seleccionada */}
      {grupoActivo && (
        <section aria-labelledby="grupo-activo">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-500)]/10 text-[var(--color-primary-600)]">
              {(() => {
                const Icono = iconoDisciplina(grupoActivo.disciplina.nombre as string);
                return <Icono aria-hidden="true" />;
              })()}
            </span>
            <div className="min-w-0">
              <h2 id="grupo-activo" className="text-lg sm:text-xl font-bold text-[var(--text-primary)] break-words">
                Losas de {grupoActivo.disciplina.nombre as string}
              </h2>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {grupoActivo.losas.length} {grupoActivo.losas.length === 1 ? "losa disponible" : "losas disponibles"}
              </p>
            </div>
          </div>

          <div className="space-y-5">
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
        title="Solicitar permiso normal"
        size="md"
      >
        <form onSubmit={handleConfirmar} className="space-y-4">
          <div className="min-w-0 p-3 sm:p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] space-y-3 text-sm">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-[var(--text-secondary)]">Losa deportiva:</span>
              <span className="font-semibold text-[var(--text-primary)] break-words sm:text-right">{modalLosa?.nombre} ({modalLosa?.numero_l})</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-[var(--text-secondary)]">Disciplina:</span>
              <span className="font-semibold text-[var(--text-primary)] break-words sm:text-right">{modalLosa?.nombre_disciplina || "—"}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-[var(--text-secondary)]">Fecha:</span>
              <span className="font-semibold text-[var(--text-primary)] break-words sm:text-right">Hoy ({fechaHoy})</span>
            </div>
          </div>

          <Select
            label="Horario disponible para hoy *"
            value={selectedHorario}
            onChange={(e) => setSelectedHorario(e.target.value)}
            placeholder="Selecciona un bloque de hora"
            className="min-w-0 [&_select]:min-h-11 [&_select]:max-w-full"
            required
            options={horarios
              .filter((h) => h.inicio > new Date().getHours())
              .map((h) => ({
                value: h.value,
                label: `${h.label} (1 hora)`,
              }))}
          />

          <div className="flex flex-col-reverse gap-3 pt-4 border-t border-[var(--border-color)] sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={loadingReserva}
              onClick={() => setShowModal(false)}
              className="min-h-11 w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loadingReserva}
              disabled={!selectedHorario}
              className="min-h-11 w-full whitespace-normal sm:w-auto"
            >
              Confirmar reserva
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
