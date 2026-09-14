import { useState } from "react";
import { Form, Link, useNavigation, useSearchParams } from "react-router";
import type { action } from "./auth.action";
import type { Route } from "./+types/login";
export { action } from "./auth.action";
import { requireNoAuth } from "~/services/auth.server";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaArrowRight, FaShieldAlt } from "react-icons/fa";

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
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Imagen de fondo 100% nítida y cristalina */}
      <div className="fixed inset-0 bg-login" />

      {/* Tarjeta de Formulario Elegante y de Alto Nivel */}
      <div className="relative z-10 w-full max-w-[440px] animate-scale-in">
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-11 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] border border-white/60 relative overflow-hidden">
          {/* Sombra de acento sutil superior */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

          {/* Logotipo en contenedor estilizado */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-100 p-2 shadow-inner flex items-center justify-center transition-transform hover:scale-105 duration-300">
                <img
                  src="/images/logo.png"
                  alt="Logo de la UNHEVAL"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shadow-md border-2 border-white">
                ✓
              </span>
            </div>
            
            <h1 className="text-2xl font-extrabold text-slate-900 font-display tracking-tight">Acceso institucional</h1>
            <p className="text-slate-500 text-xs font-medium mt-1">
              Ingresa tus credenciales universitarias
            </p>
          </div>

          <Form method="post" action="/login" className="space-y-5">
            {/* Campo Usuario / Correo */}
            <div>
              <div className="mb-1.5">
                <label htmlFor="identifier" className="text-xs font-bold text-slate-700">Código o correo</label>
              </div>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <FaUser className="text-sm" />
                </span>
                <input
                  type="text"
                  id="identifier"
                  name="identifier"
                  placeholder="Ej: 20241001"
                  required
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all duration-200"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-xs font-bold text-slate-700">Contraseña</label>
                <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-[11px] text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                  ¿Olvidaste la clave?
                </Link>
              </div>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <FaLock className="text-sm" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-11 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all duration-200"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>

              {/* Mensaje de Error */}
              {error && (
                <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
                  {error}
                </p>
              )}
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-sm transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 motion-reduce:transform-none motion-reduce:transition-none"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Iniciando sesión...</span>
                </span>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <FaArrowRight className="text-xs" />
                </>
              )}
            </button>
          </Form>

          <Link
            to="/"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--color-primary-700)] transition-colors hover:bg-[var(--color-primary-50)] hover:text-[var(--color-unheval-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2"
          >
            <FaArrowLeft aria-hidden="true" />
            Volver a la página principal
          </Link>

          {/* Footer Informativo */}
          <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-[11px]">
            <FaShieldAlt className="text-emerald-500 text-xs" />
            <span>Conexión segura protegida por UNHEVAL</span>
          </div>
        </div>
      </div>
    </main>
  );
}
