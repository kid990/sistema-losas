import { useState } from "react";
import { Form, NavLink } from "react-router";
import { FaBars, FaUserCircle, FaUser, FaSignOutAlt } from "react-icons/fa";

interface NavbarAdminProps {
  nombreUsuario?: string;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function NavbarAdmin({ nombreUsuario, onToggleSidebar, sidebarOpen }: NavbarAdminProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 navbar-admin backdrop-blur-md">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="nav-icon p-2 rounded-lg hover:bg-black/[0.04] transition-all relative"
            title={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {sidebarOpen ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <FaBars size={18} />
            )}
          </button>
          <span className="font-semibold text-sm hidden sm:block text-[var(--navbar-text)]">
            Panel de Administración
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* User dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 text-[var(--navbar-text)] hover:text-[var(--text-primary)] px-3 py-2 rounded-xl hover:bg-black/[0.04] transition-all"
            >
              <FaUserCircle size={20} className="text-[var(--color-primary-500)]" />
              <span className="text-sm font-medium hidden sm:block">{nombreUsuario || "Usuario"}</span>
              <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-theme-card rounded-xl shadow-theme-lg border border-theme z-20 overflow-hidden animate-scale-in">
                  <NavLink
                    to="/dashboard/perfil"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-theme-primary hover:bg-black/[0.04] transition-colors"
                  >
                    <FaUser className="text-theme-muted text-xs" />
                    Perfil
                  </NavLink>
                  <div className="border-t border-[var(--border-color)]" />
                  <Form method="post" action="/logout">
                    <button
                      type="submit"
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <FaSignOutAlt />
                      Cerrar sesión
                    </button>
                  </Form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
