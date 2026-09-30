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
  const pdf = await api.getBinary(`/reportes/pdf?${query.toString()}`, request);
  const headers = responseHeadersWithCookies(request);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, no-store");

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
