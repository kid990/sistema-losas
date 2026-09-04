import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { requireAuth } from "~/services/auth.server";
import { api, ApiError } from "~/services/api.server";
import { Button, Input, Badge } from "~/shared/components/ui";
import { FaUserGraduate, FaKey, FaIdCard, FaEnvelope, FaGraduationCap } from "react-icons/fa";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (user.tipo !== "usuario") {
    throw new Response("No autorizado", { status: 403 });
  }
  const userData = await api.get(`/users/${user.id}`, request);
  return data({
    usuario: (userData as Record<string, unknown>).data || userData,
    sessionUser: user,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  const fd = await request.formData();
  const actualPassword = fd.get("actualPassword") as string;
  const nuevaPassword = fd.get("nuevaPassword") as string;

  if (!actualPassword || !nuevaPassword) {
    return data({ error: "Todos los campos son requeridos" }, { status: 400 });
  }
  if (nuevaPassword.length < 6) {
    return data({ error: "La nueva contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }

  try {
    await api.put(`/users/password/${user.id}`, request, { actualPassword, nuevaPassword });
    return data({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return data({ error: err.message || "Error al cambiar contraseña" }, { status: err.status });
    }
    return data({ error: "Error al cambiar contraseña" }, { status: 500 });
  }
}

export default function UserPerfil() {
  const { usuario, sessionUser } = useLoaderData<typeof loader>();
  const u = (usuario as Record<string, unknown>) || {};
  const [form, setForm] = useState({ actualPassword: "", nuevaPassword: "", confirmPassword: "" });
  const [errores, setErrores] = useState({ actualPassword: "", nuevaPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  const nombreCompleto =
    (u.nombre_completo as string) ||
    [u.nombres, u.apellido_p, u.apellido_m].filter(Boolean).join(" ") ||
    sessionUser.nombre ||
    "-";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { actualPassword, nuevaPassword, confirmPassword } = form;
    const nuevosErrores = {
      actualPassword: !actualPassword ? "Ingresa tu contraseña actual" : "",
      nuevaPassword: !nuevaPassword
        ? "Ingresa una nueva contraseña"
        : nuevaPassword.length < 6
          ? "Debe tener al menos 6 caracteres"
          : "",
      confirmPassword: !confirmPassword
        ? "Confirma la nueva contraseña"
        : nuevaPassword !== confirmPassword
          ? "Las contraseñas no coinciden"
          : "",
    };
    setErrores(nuevosErrores);
    if (Object.values(nuevosErrores).some((err) => err)) return;

    setLoading(true);
    const fd = new FormData();
    fd.append("actualPassword", actualPassword);
    fd.append("nuevaPassword", nuevaPassword);
    try {
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (result.error) {
        if (String(result.error).toLowerCase().includes("actual")) {
          setErrores((prev) => ({ ...prev, actualPassword: result.error }));
        } else {
          setErrores((prev) => ({ ...prev, nuevaPassword: result.error }));
        }
      } else {
        Swal.fire({
          icon: "success",
          title: "Contraseña actualizada",
          text: "Tu contraseña de acceso ha sido cambiada exitosamente.",
          timer: 2000,
          showConfirmButton: false,
        });
        setForm({ actualPassword: "", nuevaPassword: "", confirmPassword: "" });
        setErrores({ actualPassword: "", nuevaPassword: "", confirmPassword: "" });
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar la contraseña. Inténtalo más tarde.",
      });
    } finally {
      setLoading(false);
    }
  };

  const estado = (u.estado as string) || "Activo";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-theme-primary flex items-center gap-2">
          <FaUserGraduate className="text-[var(--color-primary-500)]" /> Mi Perfil Universitario
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Datos de afiliación académica institucional y gestión de credenciales.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos Personales */}
        <div className="card-theme p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border-color)]">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-600)] flex items-center justify-center font-bold">
              <FaIdCard size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Datos del Estudiante / Docente</h3>
              <p className="text-xs text-[var(--text-secondary)]">Registro validado en el padrón UNHEVAL</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Código Universitario</span>
              <p className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                {(u.codigo as string) || sessionUser.codigo || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Nombre Completo</span>
              <p className="text-base font-semibold text-[var(--text-primary)] mt-0.5">{nombreCompleto}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">DNI</span>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{(u.dni as string) || "-"}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Rol</span>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{(u.rol as string) || sessionUser.rol || "Estudiante"}</p>
              </div>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Correo Institucional</span>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
                <FaEnvelope className="text-[var(--text-muted)]" /> {(u.email as string) || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Escuela / Carrera</span>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
                <FaGraduationCap className="text-[var(--text-muted)]" /> {(u.escuela as string) || "General UNHEVAL"}
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider block mb-1">Estado de Matrícula</span>
              <Badge variant={estado === "Activo" ? "success" : "danger"} dot>
                {estado}
              </Badge>
            </div>
          </div>
        </div>

        {/* Cambiar Contraseña */}
        <div className="card-theme p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border-color)]">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <FaKey size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Seguridad de la Cuenta</h3>
              <p className="text-xs text-[var(--text-secondary)]">Actualiza tu clave de acceso</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Contraseña Actual *"
              name="actualPassword"
              type="password"
              placeholder="••••••••"
              value={form.actualPassword}
              error={errores.actualPassword}
              onChange={(e) => {
                setForm({ ...form, actualPassword: e.target.value });
                setErrores({ ...errores, actualPassword: "" });
              }}
              required
            />
            <Input
              label="Nueva Contraseña *"
              name="nuevaPassword"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.nuevaPassword}
              error={errores.nuevaPassword}
              onChange={(e) => {
                setForm({ ...form, nuevaPassword: e.target.value });
                setErrores({ ...errores, nuevaPassword: "" });
              }}
              required
              minLength={6}
            />
            <Input
              label="Confirmar Nueva Contraseña *"
              name="confirmPassword"
              type="password"
              placeholder="Repite la nueva contraseña"
              value={form.confirmPassword}
              error={errores.confirmPassword}
              onChange={(e) => {
                setForm({ ...form, confirmPassword: e.target.value });
                setErrores({ ...errores, confirmPassword: "" });
              }}
              required
              minLength={6}
            />

            <div className="pt-2">
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Actualizar Contraseña
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
