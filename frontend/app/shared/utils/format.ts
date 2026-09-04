/**
 * Formatear fecha ISO a formato local peruano (dd/mm/aaaa)
 */
export function formatFecha(fechaISO: string): string {
  if (!fechaISO) return "";
  const [year, month, day] = fechaISO.slice(0, 10).split("-").map(Number);
  const fecha = new Date(year, month - 1, day);
  if (Number.isNaN(fecha.getTime())) return fechaISO;
  return fecha.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Formatear fecha ISO a formato local peruano con hora (dd/mm/aaaa HH:mm)
 */
export function formatFechaHora(fechaISO: string): string {
  if (!fechaISO) return "";
  const f = new Date(fechaISO);
  return (
    f.toLocaleDateString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }) +
    " " +
    f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

/**
 * Obtener fecha actual en formato YYYY-MM-DD
 */
export function fechaHoy(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
}
