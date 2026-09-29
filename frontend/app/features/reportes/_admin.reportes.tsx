import { useState } from "react";
import { Form, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { FaCalendarAlt, FaChartBar, FaClock, FaLightbulb, FaPercentage } from "react-icons/fa";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { Button } from "~/shared/components/ui";

interface CourtReport { losa: string; reservas: number; horas: number }
interface ReportData {
  periodo: "mensual" | "anual";
  anio: number;
  mes: number | null;
  desde: string;
  hasta: string;
  total_permisos: number;
  horas_reservadas: number;
  tasa_aprobacion: number;
  por_estado: Record<string, number>;
  por_tipo: Record<string, number>;
  por_losa: CourtReport[];
  insights: string[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const url = new URL(request.url);
  const now = new Date();
  const periodo = url.searchParams.get("periodo") === "anual" ? "anual" : "mensual";
  const anio = Number(url.searchParams.get("anio")) || now.getFullYear();
  const mes = Number(url.searchParams.get("mes")) || now.getMonth() + 1;
  const response = await api.get(`/reportes/resumen?periodo=${periodo}&anio=${anio}&mes=${mes}`, request);
  return { report: (response as Record<string, unknown>).data as ReportData };
}

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function ReportsPage() {
  const { report } = useLoaderData<typeof loader>();
  const [period, setPeriod] = useState<"mensual" | "anual">(report.periodo);
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 5 + index);
  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-md"><FaChartBar aria-hidden="true" /></span>
        <div><h1 className="text-xl font-bold text-slate-800">Reportes de permisos</h1><p className="text-sm text-slate-500">Resumen mensual o anual de reservas y uso de losas</p></div>
      </header>

      <Form method="get" className="card-theme grid gap-4 p-5 sm:grid-cols-4 sm:items-end">
        <Field label="Tipo de reporte"><select name="periodo" value={period} onChange={(event) => setPeriod(event.target.value as "mensual" | "anual")} className="input-theme w-full rounded-xl border p-3"><option value="mensual">Mensual</option><option value="anual">Anual</option></select></Field>
        <Field label="Año"><select name="anio" defaultValue={report.anio} className="input-theme w-full rounded-xl border p-3">{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></Field>
        <Field label="Mes"><select name="mes" defaultValue={report.mes || new Date().getMonth() + 1} disabled={period === "anual"} className="input-theme w-full rounded-xl border p-3 disabled:opacity-50">{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></Field>
        <Button type="submit"><FaCalendarAlt aria-hidden="true" /> Generar reporte</Button>
      </Form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<FaChartBar />} label="Permisos" value={report.total_permisos} />
        <Stat icon={<FaClock />} label="Horas reservadas" value={report.horas_reservadas} />
        <Stat icon={<FaPercentage />} label="Tasa de aprobación" value={`${report.tasa_aprobacion}%`} />
        <Stat icon={<FaCalendarAlt />} label="Periodo" value={report.periodo === "mensual" && report.mes ? `${months[report.mes - 1]} ${report.anio}` : String(report.anio)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card-theme p-6"><h2 className="mb-4 font-bold text-slate-800">Permisos por estado</h2><Breakdown values={report.por_estado} /></div>
        <div className="card-theme p-6"><h2 className="mb-4 font-bold text-slate-800">Permisos por tipo</h2><Breakdown values={report.por_tipo} /></div>
      </section>

      <section className="card-theme overflow-hidden">
        <div className="border-b border-slate-200 p-5"><h2 className="font-bold text-slate-800">Uso por losa</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Losa</th><th className="p-4">Reservas aceptadas</th><th className="p-4">Horas</th></tr></thead><tbody>{report.por_losa.map((row) => <tr key={row.losa} className="border-t border-slate-100"><td className="p-4 font-semibold">{row.losa}</td><td className="p-4">{row.reservas}</td><td className="p-4">{row.horas}</td></tr>)}{report.por_losa.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">No hay reservas aceptadas en este periodo.</td></tr>}</tbody></table></div>
      </section>

      <section className="card-theme p-6"><div className="mb-4 flex items-center gap-2"><FaLightbulb className="text-amber-500" aria-hidden="true" /><h2 className="font-bold text-slate-800">Análisis automático</h2></div><ul className="space-y-2 text-sm text-slate-600">{report.insights.map((insight) => <li key={insight} className="rounded-xl bg-amber-50 p-3">{insight}</li>)}</ul></section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{children}</label>; }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <div className="card-theme p-5"><div className="mb-3 text-blue-600">{icon}</div><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value}</p></div>; }
function Breakdown({ values }: { values: Record<string, number> }) { const entries = Object.entries(values); return <div className="space-y-3">{entries.map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-medium text-slate-600">{label}</span><span className="font-bold text-slate-800">{value}</span></div>)}{entries.length === 0 && <p className="text-sm text-slate-500">Sin datos para este periodo.</p>}</div>; }
