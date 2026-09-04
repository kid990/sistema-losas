import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/reset-password";
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaArrowRight, FaShieldAlt } from "react-icons/fa";
import { API_BASE_URL } from "~/lib/constants";
import { requireNoAuth } from "~/services/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireNoAuth(request);
  return null;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.message || "Error al restablecer la contraseña");
      }
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
        <div className="fixed inset-0 bg-login" />
        <div className="relative z-10 w-full max-w-[440px] animate-scale-in">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 sm:p-11 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] border border-white/60 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <FaExclamationTriangle className="text-3xl" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 font-display">Enlace Inválido o Expirado</h2>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo para continuar.
            </p>
            <Link
              to="/forgot-password"
              className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md inline-flex items-center justify-center gap-2"
            >
              <FaArrowLeft className="text-xs" />
              <span>Solicitar Nuevo Enlace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Imagen de fondo 100% nítida y cristalina */}
      <div className="fixed inset-0 bg-login" />

      {/* Tarjeta de Formulario Elegante y de Alto Nivel */}
      <div className="relative z-10 w-full max-w-[440px] animate-scale-in">
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 sm:p-11 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] border border-white/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

          {/* Logotipo en contenedor estilizado */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-100 p-2 shadow-inner flex items-center justify-center transition-transform hover:scale-105 duration-300">
                <img
                  src="/images/logo.png"
                  alt="UNHEVAL Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            <h2 className="text-2xl font-extrabold text-slate-900 font-display tracking-tight">Restablecer Contraseña</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">
              Crea tu nueva contraseña de acceso
            </p>
          </div>

          {success ? (
            <div className="text-center py-4 animate-scale-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <FaCheckCircle className="text-3xl" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 font-display">Contraseña Actualizada</h3>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                Tu contraseña se ha restablecido exitosamente. Ya puedes ingresar al sistema con tus nuevas credenciales.
              </p>
              <Link
                to="/login"
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md inline-flex items-center justify-center gap-2"
              >
                <span>Ir al Inicio de Sesión</span>
                <FaArrowRight className="text-xs" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nueva Contraseña</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <FaLock className="text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-11 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all duration-200"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirmar Contraseña</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <FaLock className="text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la nueva contraseña"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-11 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all duration-200"
                  />
                </div>

                {error && (
                  <div className="text-red-700 text-xs mt-3 flex items-center gap-2.5 bg-red-50/90 p-3.5 rounded-xl border border-red-200/80 font-semibold animate-scale-in">
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Actualizando...</span>
                  </span>
                ) : (
                  <>
                    <span>Guardar Contraseña</span>
                    <FaArrowRight className="text-xs" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Informativo */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-[11px]">
            <FaShieldAlt className="text-emerald-500 text-xs" />
            <span>Actualización protegida UNHEVAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
