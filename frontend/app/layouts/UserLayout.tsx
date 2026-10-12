import { useState, useEffect } from "react";
import { Outlet, useLoaderData, redirect, data, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { api, responseHeadersWithCookies } from "~/services/api.server";
import { SidebarUser } from "~/shared/components/SidebarUser";
import { Breadcrumb } from "~/shared/components/ui/Breadcrumb";
import { ChatbotWidget } from "~/shared/components/ChatbotWidget";
import { ROLES } from "~/shared/types/roles";
import { FaBell } from "react-icons/fa";
import { NavLink } from "react-router";

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

  let notificacionesNoLeidas = 0;
  try {
    const unreadRes = await api.get(`/notificaciones/usuario/${user.id}/no-leidas`, request);
    notificacionesNoLeidas = ((unreadRes as Record<string, unknown>)?.data as { total?: number })?.total || 0;
  } catch {}

  return data({ user, notificacionesNoLeidas }, { headers: responseHeadersWithCookies(request) });
}

export default function UserLayout() {
  const { user, notificacionesNoLeidas } = useLoaderData<typeof loader>();
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
          notificacionesNoLeidas={notificacionesNoLeidas}
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
        <div className="admin-mobile-topbar lg:hidden flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
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

          <NavLink
            to="/notificaciones"
            aria-label="Notificaciones"
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <FaBell size={16} />
            {notificacionesNoLeidas > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-2xs">
                {notificacionesNoLeidas > 99 ? "99+" : notificacionesNoLeidas}
              </span>
            )}
          </NavLink>
        </div>

        <div className="admin-content flex-1">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <Breadcrumb />
            </div>
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              <NavLink
                to="/notificaciones"
                title="Bandeja de notificaciones"
                className="relative inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
              >
                <div className="relative">
                  <FaBell className="text-slate-500 text-sm" />
                  {notificacionesNoLeidas > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white shadow-2xs">
                      {notificacionesNoLeidas > 99 ? "99+" : notificacionesNoLeidas}
                    </span>
                  )}
                </div>
                <span>Notificaciones</span>
              </NavLink>
            </div>
          </div>
          <Outlet />
        </div>
      </main>

      {/* Widget flotante de Chatbot */}
      <ChatbotWidget />
    </div>
  );
}
