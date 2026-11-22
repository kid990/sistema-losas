import { useState } from "react";
import { Form, NavLink } from "react-router";
import {
  FaFileAlt,
  FaUser,
  FaUserCircle,
  FaSignOutAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { ThemeToggle } from "~/shared/components/ThemeToggle";

interface NavbarSeguridadProps {
  nombreUsuario?: string;
}

export function NavbarSeguridad({ nombreUsuario }: NavbarSeguridadProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 navbar-security text-white" aria-label="Navegación de seguridad">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <NavLink
            to="/seguridad/modulo"
            className="flex items-center gap-3 text-white"
          >
            <img src="/images/logo.png" alt="" className="w-10 h-10 rounded-full bg-white p-0.5 shadow-sm" />
            <span className="leading-tight">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-100">Personal de seguridad</span>
              <span className="block font-display text-xl font-bold">Control de acceso</span>
            </span>
          </NavLink>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <NavLink
              to="/seguridad/modulo"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-white/20 text-white font-bold" : "text-white/80 hover:text-white hover:bg-white/10"
                }`
              }
            >
              <FaFileAlt /> Permisos
            </NavLink>

            <NavLink
              to="/seguridad/perfil"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-white/20 text-white font-bold" : "text-white/80 hover:text-white hover:bg-white/10"
                }`
              }
            >
              <FaUser /> Perfil
            </NavLink>

            {/* User Dropdown */}
            <div className="relative ml-2">
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                <FaUserCircle size={18} />
                <span>{nombreUsuario || "Seguridad"}</span>
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-xl)] border border-[var(--border-color)] z-20 overflow-hidden" role="menu">
                    <NavLink
                      to="/seguridad/perfil"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <FaUser className="text-[var(--text-muted)]" /> Perfil
                    </NavLink>
                    <div className="border-t border-[var(--border-color)]" />
                    <Form method="post" action="/logout">
                      <button
                        type="submit"
                        className="flex items-center gap-2.5 w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <FaSignOutAlt /> Cerrar sesión
                      </button>
                    </Form>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="security-mobile-menu"
            className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div id="security-mobile-menu" className="md:hidden pb-4 pt-3 border-t border-white/10 space-y-2">
            <ThemeToggle showLabel className="theme-toggle--wide" />
            <NavLink
              to="/seguridad/modulo"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? "bg-white/20 text-white font-bold" : "text-white/80 hover:bg-white/10"
                }`
              }
            >
              <FaFileAlt /> Permisos
            </NavLink>
            <NavLink
              to="/seguridad/perfil"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
                  isActive ? "bg-white/20 text-white font-bold" : "text-white/80 hover:bg-white/10"
                }`
              }
            >
              <FaUser /> Perfil
            </NavLink>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="flex items-center gap-2 w-full text-left px-4 py-2.5 rounded-lg text-sm text-red-300 hover:bg-white/10"
              >
                <FaSignOutAlt /> Cerrar sesión
              </button>
            </Form>
          </div>
        )}
      </div>
    </nav>
  );
}
