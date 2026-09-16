import { useState, useEffect } from "react";
import { Outlet, useLoaderData, redirect, data, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { responseHeadersWithCookies } from "~/services/api.server";
import { SidebarUser } from "~/shared/components/SidebarUser";
import { Breadcrumb } from "~/shared/components/ui/Breadcrumb";
import { ChatbotWidget } from "~/shared/components/ChatbotWidget";
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => { setIsDesktop(media.matches); setSidebarOpen(false); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const sidebarVisible = isDesktop ? !desktopCollapsed : sidebarOpen;
  const toggleSidebar = () => isDesktop
    ? setDesktopCollapsed((prev) => !prev)
    : setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-shell min-h-screen">
      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar fijo a la izquierda */}
      <div
        id="user-sidebar"
        className={`
          fixed inset-y-0 left-0 z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${desktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"}
        `}
      >
        <SidebarUser
          nombre={user.nombre}
          onClose={closeSidebar}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarVisible}
        />
      </div>

      {/* Main content */}
      <main
        className={`min-h-screen min-w-0 flex flex-col ${desktopCollapsed ? "lg:ml-0" : "lg:ml-[260px]"}`}
      >
        {/* Topbar móvil */}
        <div className="admin-mobile-topbar lg:hidden">
          <button
            type="button"
            aria-expanded={sidebarOpen}
            aria-label="Abrir menú"
            onClick={toggleSidebar}
            className="sidebar-toggle-btn"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">SIRLOD • Alumnos</span>
        </div>

        <div className="admin-content flex-1">
          <Breadcrumb />
          <Outlet />
        </div>
      </main>

      {/* Widget flotante de Chatbot */}
      <ChatbotWidget />
    </div>
  );
}
