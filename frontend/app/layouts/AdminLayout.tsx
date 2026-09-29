import { useEffect, useRef, useState } from "react";
import { Outlet, useLoaderData, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireRole } from "~/services/auth.server";
import { Sidebar } from "~/shared/components/Sidebar";

import { Breadcrumb } from "~/shared/components/ui/Breadcrumb";
import { ChatbotWidget } from "~/shared/components/ChatbotWidget";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireRole(request, "trabajador", "Administrador");
  return { user };
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => { setIsDesktop(media.matches); setSidebarOpen(false); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSidebarOpen(false); }
      if (event.key !== "Tab") return;
      const elements = sidebarRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      toggleRef.current?.focus();
    };
  }, [sidebarOpen, isDesktop]);

  const sidebarVisible = isDesktop ? !desktopCollapsed : sidebarOpen;
  const toggleSidebar = () => isDesktop
    ? setDesktopCollapsed((prev) => !prev)
    : setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-shell min-h-screen">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar - siempre fixed */}
      <div
        id="admin-sidebar"
        ref={sidebarRef}
        inert={!sidebarVisible}
        role={!isDesktop && sidebarOpen ? "dialog" : undefined}
        aria-modal={!isDesktop && sidebarOpen ? true : undefined}
        aria-label="Menú de administración"
        className={`
          fixed inset-y-0 left-0 z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${desktopCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"}
        `}
      >
        <Sidebar
          nombreUsuario={user.nombre}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarVisible}
          toggleRef={toggleRef}
        />
      </div>

      {/* Main content */}
      <main
        inert={sidebarOpen && !isDesktop}
        className={`min-h-screen min-w-0 flex flex-col ${desktopCollapsed ? "lg:ml-0" : "lg:ml-[260px]"}`}
      >
        {/* Mini topbar solo para mobile — botón abrir sidebar */}
        <div className="admin-mobile-topbar lg:hidden">
          <button
            ref={!isDesktop ? toggleRef : undefined}
            type="button"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            aria-label="Abrir menú"
            onClick={toggleSidebar}
            className="sidebar-toggle-btn"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">SIRLOD</span>
        </div>

        <div className="admin-content flex-1">
          <Breadcrumb />
          <Outlet />
        </div>
        <ChatbotWidget />
      </main>
    </div>
  );
}
