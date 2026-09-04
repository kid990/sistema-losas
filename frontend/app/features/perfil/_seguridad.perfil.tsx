import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import Swal from "sweetalert2";
import { requireRole } from "~/services/auth.server";
import { api } from "~/services/api.server";
import { Button, Input, Badge } from "~/shared/components/ui";
import { FaUserShield, FaKey, FaIdCard, FaEnvelope, FaPhone } from "react-icons/fa";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireRole(request, "trabajador", "Seguridad");
  const trabajador = await api.get(`/trabajadores/${user.id}`, request);
  return data({ trabajador: (trabajador as Record<string, unknown>).data || trabajador });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireRole(request, "trabajador", "Seguridad");
  const fd = await request.formData();
  const actualPassword = fd.get("actualPassword") as string;
  const nuevaPassword = fd.get("nuevaPassword") as string;

  try {
    await api.put(`/trabajadores/password/${user.id}`, request, { actualPassword, nuevaPassword });
    return data({ ok: true });
  } catch (err) {
    const error = err as { status?: number; message?: string };
    return data({ error: error.message || "Error al cambiar contraseña" }, { status: error.status || 500 });
  }
}

export default function SeguridadPerfil() {
  const { trabajador } = useLoaderData<typeof loader>();
  const t = (trabajador as Record<string, unknown>) || {};
  const [form, setForm] = useState({ actualPassword: "", nuevaPassword: "", confirmPassword: "" });
  const [errores, setErrores] = useState({ actualPassword: "", nuevaPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { actualPassword, nuevaPassword, confirmPassword } = form;
    const nuevosErrores = {
      actualPassword: !actualPassword ? "Ingresa tu contraseña actual" : "",
      nuevaPassword: !nuevaPassword ? "Ingresa una nueva contraseña" : "",
      confirmPassword: !confirmPassword ? "Confirma la nueva contraseña" : "",
    };
    if (nuevaPassword && nuevaPassword.length < 4) nuevosErrores.nuevaPassword = "Debe tener al menos 4 caracteres";
    if (nuevaPassword && confirmPassword && nuevaPassword !== confirmPassword) nuevosErrores.confirmPassword = "Las contraseñas no coinciden";
    setErrores(nuevosErrores);
    if (Object.values(nuevosErrores).some((err) => err)) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("actualPassword", actualPassword);
      fd.append("nuevaPassword", nuevaPassword);
      const res = await fetch("", { method: "post", body: fd });
      const result = await res.json();
      if (result.error) {
        if (result.error.toLowerCase().includes("actual")) {
          setErrores((prev) => ({ ...prev, actualPassword: result.error }));
        } else {
          setErrores((prev) => ({ ...prev, nuevaPassword: result.error }));
        }
      } else {
        Swal.fire({
          icon: "success",
          title: "Contraseña actualizada",
          text: "Tu contraseña de seguridad se actualizó correctamente.",
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
        text: "Ocurrió un problema al cambiar la contraseña.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
          <FaUserShield className="text-[#003366]" /> Mi Perfil de Seguridad
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Información de la cuenta y gestión de clave de acceso al módulo de control.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos Personales */}
        <div className="card-theme p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border-color)]">
            <div className="w-10 h-10 rounded-xl bg-[#003366]/10 text-[#003366] flex items-center justify-center font-bold">
              <FaIdCard size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Datos del Personal</h3>
              <p className="text-xs text-[var(--text-secondary)]">Identificación institucional en el sistema</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">DNI / Documento</span>
              <p className="text-base font-semibold text-[var(--text-primary)] mt-0.5">{String(t.dni || "-")}</p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Nombre Completo</span>
              <p className="text-base font-semibold text-[var(--text-primary)] mt-0.5">
                {[t.nombres, t.apellido_p, t.apellido_m].filter(Boolean).join(" ") || "-"}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Rol de Acceso</span>
              <div className="mt-1">
                <Badge variant="info" dot>{String(t.rol || "Seguridad")}</Badge>
              </div>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Correo Electrónico</span>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
                <FaEnvelope className="text-[var(--text-muted)]" /> {String(t.email || "-")}
              </p>
            </div>
            {Boolean(t.telefono) && (
              <div>
                <span className="text-xs text-[var(--text-muted)] uppercase font-semibold tracking-wider">Teléfono de Contacto</span>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
                  <FaPhone className="text-[var(--text-muted)]" /> {String(t.telefono)}
                </p>
              </div>
            )}
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
              <p className="text-xs text-[var(--text-secondary)]">Actualiza tu contraseña de acceso</p>
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
              placeholder="Mínimo 4 caracteres"
              value={form.nuevaPassword}
              error={errores.nuevaPassword}
              onChange={(e) => {
                setForm({ ...form, nuevaPassword: e.target.value });
                setErrores({ ...errores, nuevaPassword: "" });
              }}
              required
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
            />

            <div className="pt-2">
              <Button type="submit" loading={loading} className="w-full">
                Actualizar Contraseña
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
