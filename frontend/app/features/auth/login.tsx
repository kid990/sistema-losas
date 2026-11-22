import { useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import type { action } from "./auth.action";
import type { Route } from "./+types/login";
export { action } from "./auth.action";
import { requireNoAuth } from "~/services/auth.server";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaArrowRight, FaShieldAlt } from "react-icons/fa";
import { ThemeToggle } from "~/shared/components/ThemeToggle";

export async function loader({ request }: Route.LoaderArgs) {
  await requireNoAuth(request);
  return null;
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="auth-shell min-h-screen">
      <header className="auth-header">
        <Link to="/" className="auth-brand" aria-label="Volver al inicio">
          <img src="/images/logo.png" alt="" width={48} height={48} />
          <span>
            <span className="auth-brand__eyebrow">UNHEVAL · Bienestar Universitario</span>
            <strong>Reserva de losas</strong>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="auth-main">
        <div>
          <p className="role-hero__eyebrow text-[var(--color-primary-600)]">Acceso institucional</p>
          <h1 className="text-4xl font-bold">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Ingresa con tu código o correo institucional para continuar.
          </p>
        </div>

        <Form method="post" action="/login" className="auth-form" aria-busy={isSubmitting}>
          {error && (
            <div role="alert" className="rounded-lg border border-[var(--color-status-danger)] bg-[var(--color-status-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-status-danger)]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="identifier" className="auth-label">Código o correo</label>
            <div className="auth-field">
              <FaUser aria-hidden="true" />
              <input
                type="text"
                id="identifier"
                name="identifier"
                placeholder="Ej. 20241001"
                autoComplete="username"
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="password" className="auth-label">Contraseña</label>
              <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--color-primary-600)] underline-offset-4 hover:underline">
                ¿Olvidaste tu clave?
              </Link>
            </div>
            <div className="auth-field">
              <FaLock aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="app-button app-button--primary w-full">
            {isSubmitting ? "Iniciando sesión…" : <><span>Iniciar sesión</span><FaArrowRight aria-hidden="true" /></>}
          </button>

          <p className="flex items-center justify-center gap-2 border-t border-[var(--border-color)] pt-4 text-xs text-[var(--text-secondary)]">
            <FaShieldAlt aria-hidden="true" className="text-[var(--color-status-success)]" />
            Tus credenciales se transmiten mediante una conexión protegida.
          </p>
        </Form>

        <Link to="/" className="app-button app-button--secondary self-center">
          <FaArrowLeft aria-hidden="true" /> Ver información pública
        </Link>
      </main>
    </div>
  );
}
