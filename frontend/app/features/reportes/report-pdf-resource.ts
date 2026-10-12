import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { requireRole } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");

  const url = new URL(request.url);
  const query = new URLSearchParams({
    periodo: url.searchParams.get("periodo") === "anual" ? "anual" : "mensual",
    anio: url.searchParams.get("anio") || String(new Date().getFullYear()),
    mes: url.searchParams.get("mes") || String(new Date().getMonth() + 1),
  });
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const periodoParam = url.searchParams.get("periodo") === "anual" ? "anual" : "mensual";
  const anioParam = url.searchParams.get("anio") || String(new Date().getFullYear());
  const mesParam = Number(url.searchParams.get("mes")) || new Date().getMonth() + 1;
  const monthName = months[mesParam - 1] || `Mes_${mesParam}`;
  const dignifiedFilename =
    periodoParam === "mensual"
      ? `SIRLOD_Reporte_Ejecutivo_${monthName}_${anioParam}.pdf`
      : `SIRLOD_Reporte_Ejecutivo_Anual_${anioParam}.pdf`;

  const pdf = await api.getBinary(`/reportes/pdf?${query.toString()}`, request);
  const headers = responseHeadersWithCookies(request);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `inline; filename="${dignifiedFilename}"`);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");

  return new Response(pdf, { headers });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, "trabajador", "Administrador");

  const url = new URL(request.url);
  const query = new URLSearchParams({
    periodo: url.searchParams.get("periodo") === "anual" ? "anual" : "mensual",
    anio: url.searchParams.get("anio") || String(new Date().getFullYear()),
    mes: url.searchParams.get("mes") || String(new Date().getMonth() + 1),
  });
  const path = `/reportes?${query.toString()}`;
  const result = request.method === "DELETE"
    ? await api.delete(path, request)
    : await api.post(`/reportes/regenerar?${query.toString()}`, request);
  const headers = responseHeadersWithCookies(request);
  headers.set("Content-Type", "application/json");

  return Response.json(result, { headers });
}
