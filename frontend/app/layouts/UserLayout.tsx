import { useState } from "react";
import { Outlet, useLoaderData, redirect, data } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { responseHeadersWithCookies } from "~/services/api.server";
import { SidebarUser } from "~/shared/components/SidebarUser";
import { Breadcrumb } from "~/shared/components/ui/Breadcrumb";
import { ROLES } from "~/shared/types/roles";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  // Solo usuarios normales pueden acceder a este panel
  if (user.tipo !== ROLES.USUARIO.tipo) {
    if (user.tipo === ROLES.ADMIN.tipo && user.rol === ROLES.ADMIN.rol) {
      throw redirect("/dashboard/inicio");
    }
    if (user.tipo === ROLES.SEGURIDAD.tipo && user.rol === ROLES.SEGURIDAD.rol) {
      throw redirect("/seguridad/modulo");
    }
    throw redirect("/");
  }

  return data({ user }, { headers: responseHeadersWithCookies(request) });
}

export default function UserLayout() {
  const { user } = useLoaderData<typeof loader>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <a
        href="#contenido-principal"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-lg bg-white px-4 py-3 font-semibold text-[var(--color-primary-600)] shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
      >
        Ir al contenido principal
      </a>

      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Botón para abrir el menú en móvil (desktop usa el sidebar fijo) */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Abrir menú de navegación"
        className="lg:hidden fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#1B6EB6] to-[#1a237e] text-white shadow-lg shadow-blue-900/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
      >
        <svg className="w-5 h-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar lateral fijo a la izquierda */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <SidebarUser nombre={user.nombre} onClose={closeSidebar} />
      </div>

      {/* Contenido principal con margen por el sidebar fijo */}
      <main id="contenido-principal" tabIndex={-1} className="min-h-screen flex flex-col lg:ml-[260px]">
        <div className="flex-1 w-full max-w-[1400px] mx-auto px-3 pt-16 pb-4 sm:px-4 md:px-6 lg:pt-6">
          <Breadcrumb />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
