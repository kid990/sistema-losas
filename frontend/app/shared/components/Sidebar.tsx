import { useEffect, useRef, useState } from "react";
import { Form, NavLink } from "react-router";
import {
  FaHome, FaKey, FaShieldAlt, FaUserTie, FaThLarge,
  FaGraduationCap, FaBell, FaBriefcase, FaImages, FaCog,
  FaUser, FaSignOutAlt, FaBars, FaChevronUp,
} from "react-icons/fa";

const groups = [
  { title: "General", items: [
    { to: "/dashboard/inicio", icon: FaHome, label: "Inicio" },
    { to: "/dashboard/permisos", icon: FaKey, label: "Solicitudes de permiso" },
    { to: "/dashboard/detalle-permisos", icon: FaShieldAlt, label: "Detalle de reservas" },
    { to: "/dashboard/notificacion", icon: FaBell, label: "Notificaciones" },
  ] },
  { title: "Espacios deportivos", items: [
    { to: "/dashboard/losas", icon: FaThLarge, label: "Losas deportivas" },
    { to: "/dashboard/disciplinas", icon: FaGraduationCap, label: "Disciplinas" },
    { to: "/dashboard/imagenes", icon: FaImages, label: "Galería de imágenes" },
  ] },
  { title: "Administración", items: [
    { to: "/dashboard/usuarios", icon: FaUserTie, label: "Usuarios" },
    { to: "/dashboard/trabajadores", icon: FaBriefcase, label: "Trabajadores" },
    { to: "/dashboard/configuracion", icon: FaCog, label: "Configuración" },
  ] },
];

interface SidebarProps {
  nombreUsuario?: string;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  toggleRef?: React.Ref<HTMLButtonElement>;
}

export function Sidebar({ nombreUsuario, onToggleSidebar, sidebarOpen, toggleRef }: SidebarProps) {
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

  const initials = (nombreUsuario || "U").charAt(0).toUpperCase();

  return (
    <nav className="admin-sidebar" aria-label="Navegación administrativa">
      {/* ── Header compacto ── */}
      <div className="admin-brand-compact">
        <NavLink to="/dashboard/inicio" className="admin-brand-logo" aria-label="Ir al inicio">
          <span className="admin-brand-mark" aria-hidden="true">
            <FaThLarge size={15} />
          </span>
          <span className="admin-brand-text">
            <strong>SIRLOD<span className="text-[var(--color-primary-500)]">.</span></strong>
            <span className="block text-[10px] text-slate-400 font-medium tracking-tight -mt-0.5">Panel Administrativo</span>
          </span>
        </NavLink>
        {/* Botón toggle sidebar */}
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={sidebarOpen}
          aria-controls="admin-sidebar"
          aria-label={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
          onClick={onToggleSidebar}
          className="sidebar-toggle-btn"
          title={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
        >
          <FaBars size={15} />
        </button>
      </div>

      {/* ── Nav groups ── */}
      <div className="admin-nav-groups">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="admin-nav-heading">{group.title}</h2>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-[#1B6EB6] font-bold shadow-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-[#1B6EB6] before:rounded-r-full"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
              >
                <item.icon aria-hidden="true" size={15} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </section>
        ))}
      </div>

      {/* ── Footer: Perfil ── */}
      <div className="admin-sidebar-footer">
        {/* Submenú del perfil (aparece arriba) */}
        {profileOpen && (
          <div ref={profileMenuRef} className="admin-sidebar-profile-menu" role="menu" aria-label="Opciones de usuario">
            <NavLink
              to="/dashboard/perfil"
              role="menuitem"
              onClick={() => setProfileOpen(false)}
              className="admin-sidebar-profile-item"
            >
              <FaUser size={13} aria-hidden="true" />
              <span>Mi perfil</span>
            </NavLink>
            <div className="admin-sidebar-footer-divider" />
            <Form method="post" action="/logout">
              <button
                type="submit"
                role="menuitem"
                className="admin-sidebar-profile-item admin-sidebar-profile-item--danger w-full"
              >
                <FaSignOutAlt size={13} aria-hidden="true" />
                <span>Cerrar sesión</span>
              </button>
            </Form>
          </div>
        )}

        {/* Botón del perfil */}
        <button
          ref={profileRef}
          type="button"
          aria-label={`Opciones de ${nombreUsuario || "usuario"}`}
          aria-expanded={profileOpen}
          aria-haspopup="menu"
          onClick={() => setProfileOpen((p) => !p)}
          className="admin-sidebar-profile-btn"
        >
          <span className="admin-avatar-sm" aria-hidden="true">{initials}</span>
          <span className="admin-sidebar-profile-info">
            <span className="admin-sidebar-profile-name">{nombreUsuario || "Usuario"}</span>
            <span className="admin-sidebar-profile-role">Administrador</span>
          </span>
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
