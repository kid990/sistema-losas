import { useState, useRef, useEffect } from "react";
import { Form, NavLink } from "react-router";
import {
  FaHome,
  FaFutbol,
  FaClock,
  FaFileAlt,
  FaUserCircle,
  FaSignOutAlt,
  FaChevronUp,
  FaBars,
  FaThLarge,
} from "react-icons/fa";

interface SidebarUserProps {
  nombre?: string;
  onClose?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  toggleRef?: React.Ref<HTMLButtonElement>;
}

const navItems = [
  { to: "/inicio", icon: FaHome, label: "Inicio" },
  { to: "/losas", icon: FaFutbol, label: "Losas Deportivas" },
  { to: "/horario", icon: FaClock, label: "Horarios de Atención" },
  { to: "/permiso", icon: FaFileAlt, label: "Mis Permisos" },
];

export function SidebarUser({
  nombre = "Estudiante / Docente",
  onClose,
  onToggleSidebar,
  sidebarOpen,
  toggleRef,
}: SidebarUserProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node) && !profileRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [profileOpen]);

  const inicial = (nombre || "U").charAt(0).toUpperCase();

  return (
    <nav className="admin-sidebar" aria-label="Menú del estudiante">
      {/* ── Header compacto de 56px ── */}
      <div className="admin-brand-compact">
        <NavLink to="/losas" className="admin-brand-logo" onClick={onClose} aria-label="Ir a losas">
          <span className="admin-brand-mark" aria-hidden="true">
            <FaThLarge size={15} />
          </span>
          <span className="admin-brand-text">
            <strong>SIRLOD<span className="text-[var(--color-primary-500)]">.</span></strong>
            <span className="block text-[10px] text-slate-400 font-medium tracking-tight -mt-0.5">Portal Alumnos</span>
          </span>
        </NavLink>
        {/* Botón toggle sidebar */}
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={sidebarOpen}
          aria-controls="user-sidebar"
          aria-label={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
          onClick={onToggleSidebar}
          className="sidebar-toggle-btn"
          title={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
        >
          <FaBars size={15} />
        </button>
      </div>

      {/* ── Grupos de navegación scrollables ── */}
      <div className="admin-nav-groups">
        <section aria-label="Servicios Estudiantiles">
          <p className="admin-nav-heading">Servicios</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-[#1B6EB6] font-bold shadow-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-[#1B6EB6] before:rounded-r-full"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`
              }
            >
              <item.icon size={15} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </section>
      </div>

      {/* ── Footer: Perfil con submenú pop-up ── */}
      <div className="admin-sidebar-footer">
        {profileOpen && (
          <div ref={profileMenuRef} className="admin-sidebar-profile-menu" role="menu" aria-label="Opciones de perfil">
            <NavLink
              to="/perfil"
              role="menuitem"
              onClick={() => { setProfileOpen(false); onClose?.(); }}
              className="admin-sidebar-profile-item"
            >
              <FaUserCircle size={14} className="text-[var(--text-muted)]" />
              <span>Mi perfil</span>
            </NavLink>
            <div className="admin-sidebar-footer-divider" />
            <Form method="post" action="/logout">
              <button
                type="submit"
                role="menuitem"
                className="admin-sidebar-profile-item admin-sidebar-profile-item--danger w-full"
              >
                <FaSignOutAlt size={14} />
                <span>Cerrar sesión</span>
              </button>
            </Form>
          </div>
        )}

        <button
          ref={profileRef}
          type="button"
          onClick={() => setProfileOpen((prev) => !prev)}
          className="admin-sidebar-profile-btn"
          aria-expanded={profileOpen}
          aria-haspopup="menu"
          aria-label="Menú de usuario"
        >
          <span className="admin-avatar-sm" aria-hidden="true">{inicial}</span>
          <div className="admin-sidebar-profile-info">
            <span className="admin-sidebar-profile-name">{nombre}</span>
            <span className="admin-sidebar-profile-role">Alumno / Usuario</span>
          </div>
          <FaChevronUp
            size={11}
            aria-hidden="true"
            className={`admin-sidebar-profile-chevron ${profileOpen ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </div>
    </nav>
  );
}