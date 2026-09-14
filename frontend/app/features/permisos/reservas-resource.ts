import type { ActionFunctionArgs } from "react-router";
import { action as reserve } from "../horarios/_public.horario";

// Una ruta sin componente devuelve JSON, sin renderizar la página ni sus loaders.
export async function action(args: ActionFunctionArgs) {
  try {
    const result = await reserve(args);
    return Response.json(result.data, result.init ?? undefined);
  } catch (error) {
    if (error instanceof Response) {
      const redirect = error.headers.get("Location");
      if (redirect) {
        const headers = new Headers(error.headers);
        headers.delete("Location");
        return Response.json(
          { ok: false, error: "Tu sesión terminó. Inicia sesión nuevamente para reservar.", code: "SESSION_TERMINATED" },
          { status: 401, headers },
        );
      }
      return Response.json(
        { ok: false, error: (await error.text()) || "No tienes autorización para reservar." },
        { status: error.status },
      );
    }
    throw error;
  }
}
