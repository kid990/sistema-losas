import { useEffect, useRef, useState, type Ref } from "react";
import { Form, NavLink } from "react-router";
import { FaBars, FaBell, FaUser, FaSignOutAlt } from "react-icons/fa";

interface NavbarAdminProps {
  nombreUsuario?: string;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  toggleRef?: Ref<HTMLButtonElement>;
}

export function NavbarAdmin({ nombreUsuario, onToggleSidebar, sidebarOpen, toggleRef }: NavbarAdminProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [dropdownOpen]);

  return (
    <nav className="sticky top-0 z-20 navbar-admin" aria-label="Opciones de administración">
      <div className="flex items-center justify-between h-16 px-4 md:px-7">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={onToggleSidebar}
            className="nav-icon min-h-11 min-w-11 flex items-center justify-center p-2 rounded-lg hover:bg-black/[0.04] transition-all relative"
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
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <NavLink to="/dashboard/notificacion" aria-label="Ver notificaciones" className="admin-header-icon"><FaBell aria-hidden="true" size={17} /></NavLink>
          {/* User dropdown */}
          <div ref={dropdownRef} className="relative"
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(false); }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && dropdownOpen) {
                event.preventDefault(); setDropdownOpen(false); profileRef.current?.focus();
              }
            }}>
            <button
              ref={profileRef}
              type="button"
              aria-label={`Opciones de ${nombreUsuario || "usuario"}`}
              aria-expanded={dropdownOpen}
              aria-controls="admin-profile-options"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 text-[var(--navbar-text)] hover:text-[var(--text-primary)] px-3 py-2 rounded-xl hover:bg-black/[0.04] transition-all"
            >
              <span className="admin-avatar" aria-hidden="true">{(nombreUsuario || "Usuario").charAt(0).toUpperCase()}</span>
              <span className="hidden sm:block text-left"><span className="block text-sm font-semibold max-w-40 truncate">{nombreUsuario || "Usuario"}</span><span className="block text-xs text-theme-secondary">Administrador</span></span>
              <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                <div id="admin-profile-options" className="absolute right-0 top-full mt-2 w-56 bg-theme-card rounded-xl shadow-theme-lg border border-theme z-20 overflow-hidden animate-scale-in">
                  <NavLink
                    to="/dashboard/perfil"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-theme-primary hover:bg-black/[0.04] transition-colors"
                  >
                    <FaUser className="text-theme-muted text-xs" />
                    Mi perfil
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
