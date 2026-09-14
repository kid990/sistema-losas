import assert from "node:assert/strict";
import { createCookieSessionStorage, createRequestHandler } from "react-router";
import * as build from "../build/server/index.js";

const storage = createCookieSessionStorage({ cookie: {
  name: "_session", secrets: [process.env.SESSION_SECRET || "sistema-losa-secret-key-change-in-production"], path: "/",
} });
const session = await storage.getSession();
session.set("user", { id: 1, tipo: "usuario", rol: "Alumno" });
const cookie = (await storage.commitSession(session)).split(";")[0];
const handler = createRequestHandler(build, "test");
const originalFetch = globalThis.fetch;
try {
  for (const [status, code, message] of [
    [409, "SCHEDULE_CONFLICT", "La losa ya está reservada de 14:00 a 15:00"],
    [400, "GROUP_WEEKLY_LIMIT", "Tu grupo ya alcanzó el límite semanal"],
    [429, "RATE_LIMITED", "Demasiadas peticiones, intenta de nuevo en 15 minutos"],
  ]) {
    let calls = 0;
    globalThis.fetch = async (url) => {
      assert.ok(String(url).endsWith("/api/permisos"));
      calls++;
      return Response.json({ message, code }, { status });
    };
    const form = new FormData();
    form.set("intent", "reservar");
    form.set("tipo", "Normal");
    form.set("detalles", JSON.stringify([{ id_l: 1, fecha: "2026-09-14", hora_inicio: "14:00", hora_fin: "15:00", duracion: 1 }]));
    const response = await handler(new Request("http://localhost:5173/api/reservas", {
      method: "POST", headers: { Cookie: cookie }, body: form,
    }));
    assert.equal(response.status, status);
    assert.match(response.headers.get("Content-Type"), /application\/json/);
    const payload = await response.json();
    assert.equal(payload.error, message);
    assert.equal(payload.code, code);
    assert.equal(payload.ok, false);
    assert.equal(calls, 1, "No deben ejecutarse los loaders de la página");
    console.log(`${status} ${code}: mensaje JSON conservado; una llamada al backend`);
  }
} finally {
  globalThis.fetch = originalFetch;
}
