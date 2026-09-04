import { useState } from "react";
import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireRole } from "~/services/auth.server";
import { Sidebar } from "~/shared/components/Sidebar";
import { NavbarAdmin } from "./NavbarAdmin";

import { Breadcrumb } from "~/shared/components/ui/Breadcrumb";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireRole(request, "trabajador", "Administrador");
  return { user };
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar - Siempre fixed, no se desplaza con el contenido */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <Sidebar nombre={user.nombre} rol={user.rol} />
      </div>

      {/* Main content - margen izquierdo en desktop por el sidebar fijo */}
      <main className="min-h-screen flex flex-col lg:ml-[260px]">
        <NavbarAdmin
          nombreUsuario={user.nombre}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
        />
        <div className="flex-1 p-4 md:p-6 lg:p-8 page-enter bg-[var(--bg-body)]">
          <Breadcrumb />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
