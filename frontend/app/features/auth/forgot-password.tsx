import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/forgot-password";
import { FaEnvelope, FaArrowLeft, FaCheckCircle, FaArrowRight, FaShieldAlt } from "react-icons/fa";
import { API_BASE_URL } from "~/lib/constants";
import { requireNoAuth } from "~/services/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireNoAuth(request);
  return null;
}

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.message || "Error al enviar la solicitud");
      }
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Imagen de fondo 100% nítida y cristalina */}
      <div className="fixed inset-0 bg-login" />

      {/* Tarjeta de Formulario Elegante y de Alto Nivel */}
      <div className="relative z-10 w-full max-w-[440px] animate-scale-in">
        <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 sm:p-11 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] border border-white/60 relative overflow-hidden">
          {/* Sombra de acento sutil superior */}
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
            
            <h2 className="text-2xl font-extrabold text-slate-900 font-display tracking-tight">Recuperar Contraseña</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">
              Ingresa tu código de alumno o correo institucional
            </p>
          </div>

          {sent ? (
            <div className="text-center py-4 animate-scale-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm">
                <FaCheckCircle className="text-3xl" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 font-display">Solicitud Enviada</h3>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                Si el usuario existe en el sistema, recibirás un correo electrónico con las instrucciones para restablecer tu contraseña.
              </p>
              <Link
                to="/login"
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md inline-flex items-center justify-center gap-2"
              >
                <FaArrowLeft className="text-xs" />
                <span>Volver al Inicio de Sesión</span>
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <div className="mb-1.5">
                    <label className="text-xs font-bold text-slate-700">Código o Correo Institucional</label>
                  </div>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <FaEnvelope className="text-sm" />
                    </span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Ej: 20241001"
                      required
                      className="w-full pl-10 pr-4 py-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all duration-200"
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
                  disabled={loading || !identifier.trim()}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Enviando instrucciones...</span>
                    </span>
                  ) : (
                    <>
                      <span>Enviar Instrucciones</span>
                      <FaArrowRight className="text-xs" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  <FaArrowLeft className="text-xs" />
                  <span>Volver al Inicio de Sesión</span>
                </Link>
              </div>
            </>
          )}

          {/* Footer Informativo */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-[11px]">
            <FaShieldAlt className="text-emerald-500 text-xs" />
            <span>Sistema oficial de recuperación UNHEVAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
