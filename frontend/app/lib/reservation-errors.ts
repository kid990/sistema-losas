export interface ReservationConflict {
  error?: string;
  detalle?: {
    id_l?: number;
    fecha?: string;
    hora_inicio?: string;
    hora_fin?: string;
  };
}

export interface ReservationErrorPayload {
  message?: string;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
  conflicts?: ReservationConflict[];
}

type UnknownRecord = Record<string, unknown>;

function objectValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

export function normalizeReservationApiError(
  error: unknown,
  fallbackMessage: string,
): { status: number; payload: ReservationErrorPayload } {
  const source = objectValue(error);
  const backend = objectValue(source.data);
  const backendDetails = objectValue(backend.details);
  const validationErrors = Array.isArray(backend.errors) ? backend.errors : undefined;

  return {
    status: typeof source.status === "number" ? source.status : 500,
    payload: {
      message:
        (typeof backend.message === "string" && backend.message) ||
        (typeof source.message === "string" && source.message) ||
        fallbackMessage,
      code: typeof backend.code === "string" ? backend.code : undefined,
      details:
        Object.keys(backendDetails).length > 0
          ? backendDetails
          : validationErrors
            ? { errors: validationErrors }
            : undefined,
      conflicts: Array.isArray(backend.conflicts)
        ? (backend.conflicts as ReservationConflict[])
        : undefined,
    },
  };
}

export function reservationErrorTitle(code?: string) {
  if (code === "SCHEDULE_CONFLICT" || code === "OVERLAPPING_REQUEST_BLOCKS") {
    return "Horario no disponible";
  }
  if (code?.startsWith("GROUP_")) return "Límite de reservas alcanzado";
  if (code === "BLOCKED_DATE") return "Fecha no disponible";
  if (code === "REQUEST_WINDOW_CLOSED") return "Fuera del horario de solicitudes";
  if (code === "RATE_LIMITED") return "Demasiadas solicitudes";
  return "No se pudo reservar";
}

export function reservationErrorMessage(payload: ReservationErrorPayload) {
  const base = payload.error || payload.message || "Ocurrió un error al registrar la reserva";
  const validationMessages = Array.isArray(payload.details?.errors)
    ? payload.details.errors
        .map((error) => {
          if (!error || typeof error !== "object") return "";
          const item = error as { field?: string; message?: string };
          if (!item.message) return "";
          return item.field ? `${item.field}: ${item.message}` : item.message;
        })
        .filter(Boolean)
    : [];
  const conflictMessages = (payload.conflicts || [])
    .map((conflict) => {
      if (conflict.error) return conflict.error;
      const detail = conflict.detalle;
      if (!detail) return "Uno de los bloques seleccionados no está disponible";
      return `La losa #${detail.id_l || "?"} no está disponible el ${detail.fecha || "día indicado"} de ${detail.hora_inicio || "?"} a ${detail.hora_fin || "?"}`;
    })
    .filter((message, index, messages) => message && messages.indexOf(message) === index);
  return [base, ...validationMessages, ...conflictMessages]
    .filter((message, index, messages) => message && messages.indexOf(message) === index)
    .join(" ");
}
