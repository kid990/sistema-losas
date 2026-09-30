import { useEffect, useRef, useState } from "react";
import { Form, data, useLoaderData, useNavigation, useSubmit } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  FaCalendarAlt,
  FaDownload,
  FaFilePdf,
  FaSyncAlt,
  FaTrash,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { requireRole } from "~/services/auth.server";
import { Button, Spinner } from "~/shared/components/ui";

interface ReportState {
  existe: boolean;
  id_reporte?: number;
  nombre_archivo?: string;
  tamanio?: number;
  fuente_ia?: string;
  created_at?: string;
  updated_at?: string;
}

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");
  const url = new URL(request.url);
  const now = new Date();
  const periodo: "mensual" | "anual" =
    url.searchParams.get("periodo") === "anual" ? "anual" : "mensual";
  const anio = Number(url.searchParams.get("anio")) || now.getFullYear();
  const mes = Number(url.searchParams.get("mes")) || now.getMonth() + 1;
  const query = new URLSearchParams({
    periodo,
    anio: String(anio),
    mes: String(mes),
  });
  const response = await api.get(`/reportes/estado?${query.toString()}`, request);
  const report = ((response as Record<string, unknown>).data || response) as ReportState;
  return data(
    { periodo, anio, mes, report },
    { headers: responseHeadersWithCookies(request) },
  );
}

export default function ReportsPage() {
  const { periodo, anio, mes, report } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [period, setPeriod] = useState<"mensual" | "anual">(periodo);
  const [hasReport, setHasReport] = useState(report.existe);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState("Cargando reporte guardado…");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [action, setAction] = useState<"regenerating" | "deleting" | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const years = Array.from(
    { length: 7 },
    (_, index) => new Date().getFullYear() - 5 + index,
  );
  const reportParams = new URLSearchParams({
    periodo,
    anio: String(anio),
    mes: String(mes),
  });
  const reportUrl = `/api/reportes/pdf?${reportParams.toString()}`;
  const reportKey = `${periodo}-${anio}-${periodo === "mensual" ? mes : 0}`;
  const periodLabel = periodo === "mensual" ? `${months[mes - 1]} ${anio}` : `Año ${anio}`;
  const downloadName = report.nombre_archivo || `reporte-permisos-${reportKey}.pdf`;
  const selectingPeriod = navigation.state !== "idle";
  const showPdfLoading = selectingPeriod || loadingPdf || action === "regenerating";

  function clearPreview() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPdfUrl(null);
    setPdfError(null);
  }

  useEffect(() => {
    setPeriod(periodo);
    setHasReport(report.existe);
    clearPreview();
    if (report.existe) {
      setLoadingTitle("Cargando reporte guardado…");
      setRequestedKey(reportKey);
      setLoadVersion((value) => value + 1);
    } else {
      setRequestedKey(null);
      setLoadingPdf(false);
    }
  }, [periodo, anio, mes, report.existe, reportKey]);

  useEffect(() => {
    if (requestedKey !== reportKey) return;
    const controller = new AbortController();
    setLoadingPdf(true);
    setPdfError(null);

    async function loadPdf() {
      try {
        const response = await fetch(reportUrl, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Tu sesión venció. Vuelve a iniciar sesión."
              : "No se pudo obtener el reporte.",
          );
        }
        const blob = await response.blob();
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(blob);
        setPdfUrl(objectUrlRef.current);
        setHasReport(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPdfError(error instanceof Error ? error.message : "No se pudo obtener el reporte.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingPdf(false);
      }
    }

    void loadPdf();
    return () => controller.abort();
  }, [loadVersion, reportKey, reportUrl, requestedKey]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function handleFiltersChange(event: React.ChangeEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.name === "periodo") {
      setPeriod(target.value as "mensual" | "anual");
    }
    submit(event.currentTarget, { replace: true });
  }

  function handleGenerate() {
    setLoadingTitle("Generando reporte con IA…");
    setRequestedKey(reportKey);
    setLoadVersion((value) => value + 1);
  }

  async function handleRegenerate() {
    const confirmation = await Swal.fire({
      icon: "question",
      title: "¿Regenerar este reporte?",
      text: "Se consultarán nuevamente los datos y DeepSeek creará una versión actualizada.",
      showCancelButton: true,
      confirmButtonText: "Sí, regenerar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
    });
    if (!confirmation.isConfirmed) return;

    setAction("regenerating");
    setLoadingTitle("Regenerando reporte con IA…");
    setPdfError(null);
    try {
      const response = await fetch(reportUrl, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("No se pudo regenerar el reporte.");
      setRequestedKey(reportKey);
      setLoadVersion((value) => value + 1);
      await Swal.fire({
        icon: "success",
        title: "Reporte actualizado",
        text: "La nueva versión se guardó correctamente en S3.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "No se pudo regenerar el reporte.");
    } finally {
      setAction(null);
    }
  }

  async function handleDelete() {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar este reporte?",
      text: "Se eliminará el registro y el archivo PDF almacenado en S3.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmation.isConfirmed) return;

    setAction("deleting");
    try {
      const response = await fetch(reportUrl, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("No se pudo eliminar el reporte.");
      clearPreview();
      setRequestedKey(null);
      setHasReport(false);
      await Swal.fire({
        icon: "success",
        title: "Reporte eliminado",
        text: "El PDF fue eliminado de S3.",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "No se pudo eliminar el reporte.");
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-xl text-white shadow-md">
          <FaFilePdf aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reportes PDF</h1>
          <p className="text-sm text-slate-500">
            Selecciona un periodo para cargar su documento guardado o generar uno nuevo.
          </p>
        </div>
      </header>

      <Form
        method="get"
        onChange={handleFiltersChange}
        className="card-theme grid gap-4 p-5 sm:grid-cols-4 sm:items-end"
      >
        <Field label="Tipo de reporte">
          <select
            name="periodo"
            value={period}
            onChange={(event) => setPeriod(event.target.value as "mensual" | "anual")}
            className="input-theme w-full rounded-xl border p-3"
          >
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
        </Field>
        <Field label="Año">
          <select name="anio" value={anio} className="input-theme w-full rounded-xl border p-3">
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </Field>
        <Field label="Mes">
          <select
            name="mes"
            value={mes}
            disabled={period === "anual"}
            className="input-theme w-full rounded-xl border p-3 disabled:opacity-50"
          >
            {months.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </Field>
        <div className="flex h-12 items-center gap-2 rounded-xl bg-slate-50 px-4 text-sm text-slate-600">
          <FaCalendarAlt aria-hidden="true" />
          {selectingPeriod ? "Consultando…" : hasReport ? "Documento encontrado" : "Sin documento"}
        </div>
      </Form>

      <section className="card-theme overflow-hidden" aria-labelledby="pdf-preview-title">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="pdf-preview-title" className="font-bold text-slate-800">{periodLabel}</h2>
            <p className="text-sm text-slate-500">
              {hasReport ? "Reporte almacenado en S3" : "Todavía no existe un reporte para este periodo"}
            </p>
          </div>
          {hasReport ? (
            <div className="flex flex-wrap gap-2">
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  download={downloadName}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                >
                  <FaDownload aria-hidden="true" /> Descargar
                </a>
              ) : null}
              <Button type="button" variant="secondary" loading={action === "regenerating"} onClick={handleRegenerate}>
                <FaSyncAlt aria-hidden="true" /> Regenerar
              </Button>
              <Button type="button" variant="danger" loading={action === "deleting"} onClick={handleDelete}>
                <FaTrash aria-hidden="true" /> Eliminar
              </Button>
            </div>
          ) : null}
        </div>

        {showPdfLoading ? (
          <div className="flex min-h-[620px] flex-col items-center justify-center bg-slate-50 px-6 text-center" aria-live="polite" aria-busy="true">
            <Spinner size="lg" />
            <h3 className="text-base font-bold text-slate-700">
              {selectingPeriod ? "Buscando el reporte…" : loadingTitle}
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              {selectingPeriod
                ? "Consultando el documento correspondiente al periodo seleccionado."
                : "Espera mientras se prepara la vista previa del PDF."}
            </p>
          </div>
        ) : pdfError ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center bg-slate-50 p-8 text-center" role="alert">
            <FaFilePdf className="mb-4 text-5xl text-red-200" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-700">No se pudo procesar el reporte</h3>
            <p className="mt-2 text-sm text-slate-500">{pdfError}</p>
            {hasReport ? (
              <Button type="button" className="mt-5" onClick={() => setLoadVersion((value) => value + 1)}>
                Volver a intentar
              </Button>
            ) : null}
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={`Vista previa del reporte ${periodLabel}`}
            className="h-[72vh] min-h-[620px] w-full bg-slate-100"
          />
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center bg-slate-50 p-10 text-center">
            <FaFilePdf className="mb-4 text-5xl text-red-200" aria-hidden="true" />
            <h3 className="text-lg font-bold text-slate-700">Sin reporte para {periodLabel}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Genera el documento una sola vez; después se cargará automáticamente desde S3.
            </p>
            <Button type="button" className="mt-5" onClick={handleGenerate}>
              <FaFilePdf aria-hidden="true" /> Generar reporte
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
