import { useMemo, useState } from "react";
import { Link, data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { FaCalendarAlt, FaChartLine, FaInfoCircle } from "react-icons/fa";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";

interface Prediccion {
  fecha: string;
  hora: number;
  id_l: number;
  probabilidad: number | string;
  modelo_version: string;
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
  estado?: string;
}

const HORAS = Array.from({ length: 12 }, (_, i) => i + 7);

const ICONOS_DEMANDA: Record<string, string> = {
  Baja: "M4 10.5 8 14.5 16 6",
  Media:
    "M6 3.5h8M6 16.5h8M7 3.5c0 3.5 6 3.5 6 6.5s-6 3-6 6.5M13 3.5c0 3.5-6 3.5-6 6.5s6 3 6 6.5",
  Alta: "M5 5h10v10H5z",
};

function IconoDemanda({ nivel }: { nivel: string }) {
  return (
    <svg
      className="size-4 shrink-0 stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={ICONOS_DEMANDA[nivel] ?? ICONOS_DEMANDA.Baja}
        className={nivel === "Alta" ? "fill-current" : "fill-none"}
      />
    </svg>
  );
}

const SLOT_BASE =
  "flex min-h-13 w-full flex-col items-center justify-center gap-0.5 rounded-md border p-1 text-center text-xs leading-tight sm:text-[0.8125rem]";

function iso(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
    fecha.getDate()
  ).padStart(2, "0")}`;
}

function sumarDias(base: Date, dias: number) {
  const copia = new Date(base);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function unwrap<T>(payload: unknown): T[] {
  const contenido = (payload as { data?: unknown })?.data ?? payload;
  return Array.isArray(contenido) ? (contenido as T[]) : [];
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuth(request);

  const hoy = new Date();
  const desde = iso(hoy);
  const limite = iso(sumarDias(hoy, 30));

  const [losasData, disciplinasData, prediccionesData] = await Promise.all([
    api.get("/losas", request).catch(() => ({ data: [] })),
    api
      .get("/disciplinas/activas", request)
      .catch(() => api.get("/disciplinas/", request).catch(() => ({ data: [] }))),
    api
      .get(`/ml/ocupacion?desde=${desde}&hasta=${limite}`, request)
      .catch(() => ({ data: [] })),
  ]);

  const predicciones = unwrap<Prediccion>(prediccionesData);
  const hasta = predicciones.at(-1)?.fecha?.slice(0, 10) ?? iso(sumarDias(hoy, 14));

  return data(
    {
      losas: unwrap<Losa>(losasData),
      disciplinas: unwrap<Disciplina>(disciplinasData),
      predicciones,
      hoy: desde,
      hasta,
    },
    { headers: responseHeadersWithCookies(request) }
  );
}

function nivel(probabilidad: number) {
  if (probabilidad >= 0.7) {
    return { texto: "Alta", clase: "border-rose-600 bg-rose-100 font-semibold text-rose-900" };
  }
  if (probabilidad >= 0.45) {
    return {
      texto: "Media",
      clase: "border-2 border-dashed border-amber-600 bg-amber-100 font-semibold text-amber-900",
    };
  }
  return {
    texto: "Baja",
    clase: "border-emerald-600 bg-emerald-100 font-semibold text-emerald-900",
  };
}

export default function PrediccionesUsuario() {
  const { losas, disciplinas, predicciones, hoy, hasta } = useLoaderData<typeof loader>();
  const [fecha, setFecha] = useState(() => predicciones[0]?.fecha?.slice(0, 10) ?? hoy);

  const horaActual = new Date().getHours();
  const esHoy = fecha === hoy;
  const esFinDeSemana = [0, 6].includes(new Date(`${fecha}T00:00:00`).getDay());

  const getDisciplinaNombre = (id_d: number) =>
    disciplinas.find((x) => x.id_d === id_d)?.nombre || "";

  const delDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const fila of predicciones) {
      if (fila.fecha.slice(0, 10) === fecha) {
        mapa.set(`${fila.id_l}-${fila.hora}`, Number(fila.probabilidad));
      }
    }
    return mapa;
  }, [predicciones, fecha]);

  const franjas = HORAS.filter((hora) => !esHoy || hora > horaActual).map((hora) => ({
    hora,
    inicio: `${String(hora).padStart(2, "0")}:00`,
    fin: `${String(hora + 1).padStart(2, "0")}:00`,
  }));

  const promediosHora = franjas
    .map(({ hora }) => {
      const valores = losas
        .map((losa) => delDia.get(`${losa.id_l}-${hora}`))
        .filter((valor): valor is number => typeof valor === "number");
      return {
        hora,
        valor: valores.length
          ? valores.reduce((total, valor) => total + valor, 0) / valores.length
          : null,
      };
    })
    .filter((fila): fila is { hora: number; valor: number } => fila.valor !== null);

  const todos = franjas.flatMap(({ hora }) =>
    losas
      .map((losa) => delDia.get(`${losa.id_l}-${hora}`))
      .filter((valor): valor is number => typeof valor === "number")
  );
  const promedioDia = todos.length
    ? todos.reduce((total, valor) => total + valor, 0) / todos.length
    : null;
  const mejorHora = promediosHora.length
    ? promediosHora.reduce((mejor, fila) => (fila.valor < mejor.valor ? fila : mejor))
    : null;

  const sinPrediccion = predicciones.length === 0;
  const diaSinDatos = delDia.size === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <FaChartLine className="text-[#1B6EB6]" />
            Predicción de ocupación
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Demanda estimada por día y losa. Solo estima; no reserva el bloque.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs">
          <FaCalendarAlt className="text-slate-400" />
          <span className="sr-only">Fecha</span>
          <input
            type="date"
            value={fecha}
            min={hoy}
            max={hasta}
            onChange={(evento) => setFecha(evento.target.value)}
            className="bg-transparent font-mono text-xs text-slate-800 outline-none"
          />
        </label>
      </header>

      {sinPrediccion ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Todavía no hay predicciones cargadas.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Demanda del día
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {promedioDia === null ? "—" : `${Math.round(promedioDia * 100)}%`}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Hora más libre
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {mejorHora ? `${String(mejorHora.hora).padStart(2, "0")}:00` : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Bloques por ver
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">{todos.length}</p>
            </div>
          </div>

          {esFinDeSemana || diaSinDatos ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {esFinDeSemana
                ? "Solo se predice de lunes a viernes."
                : "No hay predicción para esta fecha."}
            </div>
          ) : franjas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Ya pasaron todos los bloques de hoy. Elige otro día.
            </div>
          ) : (
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
                    {losas.map((losa) => (
                      <th
                        key={losa.id_l}
                        scope="col"
                        className="min-w-[84px] px-0 pt-1 pb-2 text-center align-bottom"
                      >
                        <span className="block text-[11px] font-bold uppercase tracking-widest text-[var(--ui-muted)]">
                          Losa
                        </span>
                        <span
                          className="mt-1 inline-grid size-11 place-items-center rounded-md bg-[#1757b8] font-slab text-[26px] leading-none font-bold text-white shadow-[inset_0_0_0_3px_#1757b8,inset_0_0_0_5px_rgb(255_255_255/0.75)]"
                          title={`${losa.nombre}${
                            getDisciplinaNombre(losa.id_d)
                              ? ` · ${getDisciplinaNombre(losa.id_d)}`
                              : ""
                          }`}
                        >
                          {losa.numero_l || losa.id_l}
                        </span>
                        <span className="sr-only">{losa.nombre}</span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {franjas.map(({ hora, inicio, fin }) => (
                    <tr key={hora}>
                      <th
                        scope="row"
                        className="sticky left-0 z-[1] w-16 bg-[var(--ui-surface)] px-2 text-left font-slab leading-none tabular-nums sm:w-20"
                      >
                        <span className="block text-lg font-semibold text-[var(--ui-ink)]">
                          {inicio}
                        </span>
                        <span className="block text-sm font-normal text-[var(--ui-muted)]">
                          <span className="sr-only">a </span>
                          {fin}
                        </span>
                      </th>

                      {losas.map((losa) => {
                        const probabilidad = delDia.get(`${losa.id_l}-${hora}`);
                        if (probabilidad === undefined) {
                          return (
                            <td key={`${losa.id_l}-${hora}`} className="p-0">
                              <span className={`${SLOT_BASE} border-dotted border-slate-300 font-medium text-slate-500`}>
                                <span aria-hidden="true">—</span>
                                <span className="sr-only">Sin información</span>
                              </span>
                            </td>
                          );
                        }
                        const tono = nivel(probabilidad);
                        const porcentaje = Math.round(probabilidad * 100);
                        return (
                          <td key={`${losa.id_l}-${hora}`} className="p-0">
                            <span
                              className={`${SLOT_BASE} ${tono.clase}`}
                              title={`${losa.nombre} · ${inicio}: ${porcentaje}% de probabilidad de ocupación (${tono.texto.toLowerCase()})`}
                            >
                              <IconoDemanda nivel={tono.texto} />
                              <span className="text-sm font-bold tabular-nums">{porcentaje}%</span>
                              <span className="text-[10px] font-semibold tracking-wide uppercase opacity-80">
                                {tono.texto}
                              </span>
                              <span className="sr-only">
                                {tono.texto}: {porcentaje}% de probabilidad de ocupación
                              </span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                Baja &lt; 45%
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                Media 45–70%
              </span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                Alta &gt; 70%
              </span>
              <span className="rounded-full border border-dotted border-slate-300 px-3 py-1 text-slate-500">
                Sin dato
              </span>
            </div>
            <Link
              to="/horario"
              className="inline-flex items-center justify-center rounded-xl bg-[#1B6EB6] px-4 py-2 text-xs font-bold text-white hover:bg-[#155994]"
            >
              Ir a reservar
            </Link>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <FaInfoCircle className="mt-0.5 shrink-0" />
            <span>
              La probabilidad indica qué tan probable es que el bloque se ocupe. Reserva primero
              los de demanda alta. Modelo {predicciones[0]?.modelo_version ?? ""}.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
